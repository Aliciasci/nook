// Récupère l'image d'un pin Pinterest — depuis le lien de sa page, ou
// directement depuis son URL sur le CDN `i.pinimg.com`.
//
// Le navigateur ne peut faire ni l'un ni l'autre lui-même : la page HTML
// d'un pin ne renvoie pas d'en-têtes CORS (donc `fetch` échoue avant même de
// lire l'image à en extraire), et le CDN d'images de Pinterest n'en renvoie
// pas non plus pour une requête `fetch` cross-origin (seule une balise
// `<img>` passe, ce qui ne sert à rien pour la stocker). Cette fonction
// tourne côté serveur, où cette restriction n'existe pas, et renvoie l'image
// elle-même — le client n'a plus qu'à la poser dans le bucket.
//
// Réponse toujours en JSON, y compris pour l'image : en base64 plutôt qu'en
// binaire brut, pour ne pas dépendre de la façon dont le SDK client choisit
// de décoder un corps de réponse selon son `Content-Type` — le JSON est le
// seul cas dont le comportement est garanti.
//
// Restreinte aux domaines Pinterest à dessein : sans ça, ce serait un proxy
// ouvert capable de faire requêter n'importe quelle URL par le serveur
// (SSRF). L'appelant doit en plus être un compte authentifié — vérifié ici
// même, plutôt que de compter sur un réglage de plateforme qui varie d'un
// modèle de projet à l'autre.
//
// Déploiement : `supabase functions deploy extract-pin-image`, ou coller ce
// fichier dans dashboard Supabase → Edge Functions → New function (remplace
// tout le contenu par défaut par celui-ci, y compris s'il utilise déjà
// `withSupabase` — cette fonction n'en a pas besoin, elle fait sa propre
// vérification). Un seul fichier à dessein : le dashboard n'accepte
// simplement qu'un `index.ts` par fonction créée à la main.

import { createClient } from 'jsr:@supabase/supabase-js@2'

// Le client appelle depuis le navigateur, qui envoie donc un préflight `OPTIONS`.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

/** L'image brute renvoyée par Pinterest ne dépasse jamais ça après lecture. */
const MAX_FETCH_BYTES = 15 * 1024 * 1024

/** Lien vers la *page* d'un pin — il faut d'abord en extraire l'image. */
const PAGE_HOST_PATTERNS = [/(^|\.)pinterest\.[a-z.]+$/i, /^pin\.it$/i]
/** Lien déjà direct vers une image, sur le CDN de Pinterest. */
const IMAGE_HOST_PATTERNS = [/(^|\.)pinimg\.com$/i]

function isPageHost(hostname: string): boolean {
  return PAGE_HOST_PATTERNS.some((re) => re.test(hostname))
}
function isImageHost(hostname: string): boolean {
  return IMAGE_HOST_PATTERNS.some((re) => re.test(hostname))
}

/**
 * Le compte à l'origine de l'appel, ou `null` s'il n'est pas authentifié.
 * `SUPABASE_URL`/`SUPABASE_ANON_KEY` sont injectées automatiquement dans
 * toute fonction Edge par la plateforme — rien à configurer.
 */
async function authenticatedUserId(req: Request): Promise<string | null> {
  const header = req.headers.get('Authorization')
  if (!header?.startsWith('Bearer ')) return null

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !anonKey) return null

  const supabase = createClient(supabaseUrl, anonKey)
  const { data, error } = await supabase.auth.getUser(header.slice('Bearer '.length))
  return error || !data.user ? null : data.user.id
}

function json(body: unknown): Response {
  // Toujours 200 : les erreurs métier (URL refusée, pin introuvable…) sont
  // dans le corps, pas dans le code HTTP — le client n'a qu'une seule forme
  // de réponse à lire.
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

/** Cherche `og:image`, dans l'un ou l'autre ordre d'attributs. */
function extractOgImage(html: string): string | null {
  const a = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
  if (a) return a[1]
  const b = html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)
  return b ? b[1] : null
}

/** Encode en base64 par blocs — étaler un gros tableau sur `String.fromCharCode`
 *  d'un coup dépasse la pile d'appel des moteurs JS. */
function toBase64(bytes: Uint8Array): string {
  const CHUNK = 0x8000
  let binary = ''
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(binary)
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  if (!(await authenticatedUserId(req))) {
    return json({ error: 'Authentification requise.' })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Requête invalide.' })
  }

  const url = typeof body === 'object' && body !== null ? (body as Record<string, unknown>).url : undefined
  if (typeof url !== 'string' || !url.trim()) {
    return json({ error: 'URL manquante.' })
  }

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return json({ error: 'URL invalide.' })
  }

  let imageUrl: URL
  if (isImageHost(parsed.hostname)) {
    imageUrl = parsed
  } else if (isPageHost(parsed.hostname)) {
    let pageRes: Response
    try {
      pageRes = await fetch(parsed.toString(), {
        redirect: 'follow',
        // Un user-agent de navigateur : Pinterest sert un HTML dégradé (ou
        // refuse) à certains clients sans en-têtes de navigateur.
        headers: { 'User-Agent': BROWSER_UA, Accept: 'text/html,application/xhtml+xml' },
      })
    } catch {
      return json({ error: 'Impossible de joindre Pinterest.' })
    }
    if (!pageRes.ok) {
      return json({ error: `Pinterest a répondu ${pageRes.status} — le pin est peut-être privé ou supprimé.` })
    }

    const extracted = extractOgImage(await pageRes.text())
    if (!extracted) return json({ error: 'Aucune image trouvée sur ce pin.' })

    let extractedUrl: URL
    try {
      extractedUrl = new URL(extracted)
    } catch {
      return json({ error: "L'image trouvée sur ce pin a une adresse invalide." })
    }
    // Défense en profondeur : même extraite d'une page Pinterest de confiance,
    // l'image visée doit rester sur le CDN attendu.
    if (!isImageHost(extractedUrl.hostname)) {
      return json({ error: "L'image trouvée sur ce pin ne vient pas du CDN attendu." })
    }
    imageUrl = extractedUrl
  } else {
    return json({ error: 'Seuls les liens Pinterest sont acceptés ici.' })
  }

  let imgRes: Response
  try {
    imgRes = await fetch(imageUrl.toString(), { headers: { 'User-Agent': BROWSER_UA } })
  } catch {
    return json({ error: "Impossible de récupérer l'image." })
  }
  if (!imgRes.ok) return json({ error: `L'image n'a pas pu être récupérée (${imgRes.status}).` })

  const contentType = imgRes.headers.get('content-type')?.split(';')[0]?.trim() ?? ''
  if (!contentType.startsWith('image/')) {
    return json({ error: 'Ce lien ne pointe pas vers une image.' })
  }

  const bytes = new Uint8Array(await imgRes.arrayBuffer())
  if (bytes.byteLength > MAX_FETCH_BYTES) {
    return json({ error: 'Cette image est trop lourde (max 15 Mo).' })
  }

  return json({ imageBase64: toBase64(bytes), contentType })
})
