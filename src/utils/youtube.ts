// Liens YouTube : extraction de l'identifiant et du repère de lecture, et mise
// en forme des durées.
//
// Rien ici n'appelle l'API YouTube officielle (qui demanderait une clé) :
// l'identifiant se lit dans l'URL, et le titre vient d'oEmbed, un point
// d'entrée public et ouvert au CORS.

/** Un identifiant YouTube fait 11 caractères d'alphabet URL. */
const ID_RE = /^[\w-]{11}$/

export interface YouTubeRef {
  videoId: string
  /** Repère lu dans l'URL (`t=` ou `start=`), `0` s'il n'y en a pas. */
  seconds: number
}

/** Paramètre `t` d'une URL : `90`, `90s`, `1h02m03s`. */
export function parseTimeParam(value: string): number {
  const raw = value.trim().toLowerCase()
  if (/^\d+$/.test(raw)) return Number(raw)
  const match = raw.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/)
  if (!match) return 0
  const [, h, m, s] = match
  return Number(h ?? 0) * 3600 + Number(m ?? 0) * 60 + Number(s ?? 0)
}

/**
 * Accepte ce qu'on récupère en copiant depuis YouTube : `watch?v=`, `youtu.be`,
 * `/embed/`, `/shorts/`, `/live/`, l'identifiant seul — et le domaine sans
 * cookies. `null` si ce n'est reconnaissable comme aucun des deux.
 */
export function parseYouTubeUrl(input: string): YouTubeRef | null {
  const raw = input.trim()
  if (!raw) return null
  if (ID_RE.test(raw)) return { videoId: raw, seconds: 0 }

  let url: URL
  try {
    // Un lien collé sans schéma (`youtu.be/…`) reste un lien.
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`)
  } catch {
    return null
  }

  const host = url.hostname.replace(/^www\./, '')
  const segments = url.pathname.split('/').filter(Boolean)

  let videoId: string | null = null
  if (host === 'youtu.be') {
    videoId = segments[0] ?? null
  } else if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
    if (segments[0] && ['embed', 'v', 'shorts', 'live'].includes(segments[0])) videoId = segments[1] ?? null
    else videoId = url.searchParams.get('v')
  }
  if (!videoId || !ID_RE.test(videoId)) return null

  return {
    videoId,
    seconds: parseTimeParam(url.searchParams.get('t') ?? url.searchParams.get('start') ?? ''),
  }
}

/** `754` → `12:34`, `3723` → `1:02:03`. */
export function formatTimestamp(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  const pad = (n: number) => String(n).padStart(2, '0')
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

/**
 * Repère saisi à la main : `12:34`, `1:02:03`, ou un nombre de secondes.
 * `null` si la saisie n'en est pas un — l'appelant garde alors l'ancienne
 * valeur plutôt que de la remplacer par du n'importe quoi.
 */
export function parseTimestamp(value: string): number | null {
  const parts = value.trim().split(':')
  if (parts.length > 3) return null
  // Seul le premier champ peut déborder (`90:00` = une heure et demie).
  const valid = parts.every((part, i) =>
    i === 0 ? /^\d{1,4}$/.test(part) : /^\d{1,2}$/.test(part) && Number(part) < 60,
  )
  if (!valid) return null
  return parts.reduce((total, part) => total * 60 + Number(part), 0)
}

/**
 * Miniature. `max` est en 16:9 et bien assez grande pour un aperçu pleine
 * largeur, mais elle manque sur certaines vidéos : l'appelant retombe alors
 * sur `hq`, en 4:3 avec des bandes noires que le recadrage enlève.
 */
export function thumbnailUrl(videoId: string, quality: 'max' | 'hq' = 'max'): string {
  const name = quality === 'max' ? 'maxresdefault' : 'hqdefault'
  return `https://i.ytimg.com/vi/${videoId}/${name}.jpg`
}

/** Lien vers YouTube, au repère où on en était. */
export function watchUrl(videoId: string, seconds = 0): string {
  const at = Math.max(0, Math.floor(seconds))
  return `https://www.youtube.com/watch?v=${videoId}${at ? `&t=${at}s` : ''}`
}

/**
 * Titre de la vidéo via oEmbed. `null` en cas d'échec (hors ligne, vidéo
 * privée ou supprimée) : l'appelant met un titre provisoire, que l'on peut
 * de toute façon corriger à la main.
 */
export async function fetchVideoTitle(videoId: string): Promise<string | null> {
  const target = encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)
  try {
    const response = await fetch(`https://www.youtube.com/oembed?format=json&url=${target}`)
    if (!response.ok) return null
    const data: unknown = await response.json()
    const title = (data as { title?: unknown }).title
    return typeof title === 'string' && title.trim() ? title.trim() : null
  } catch {
    return null
  }
}
