// Chargement à la demande de l'API IFrame de YouTube.
//
// Le script n'est ajouté qu'au premier lancement d'une vidéo : une page de
// documentation sans vidéo, ou dont on ne lit rien, ne paie rien. YouTube
// prévient par un `onYouTubeIframeAPIReady` global une fois prêt.
//
// Les types sont déclarés ici plutôt que tirés d'un paquet : on n'utilise
// qu'une poignée de méthodes du lecteur.

export interface YouTubePlayer {
  destroy(): void
  getCurrentTime(): number
  getDuration(): number
  playVideo(): void
  pauseVideo(): void
  seekTo(seconds: number, allowSeekAhead: boolean): void
}

export interface YouTubePlayerEvent {
  target: YouTubePlayer
  data: number
}

export interface YouTubePlayerOptions {
  videoId: string
  /** `youtube-nocookie.com` pour ne pas déposer de cookie tant qu'on ne lit rien. */
  host?: string
  width?: string
  height?: string
  playerVars?: Record<string, string | number>
  events?: {
    onReady?: (event: YouTubePlayerEvent) => void
    onStateChange?: (event: YouTubePlayerEvent) => void
    onError?: (event: YouTubePlayerEvent) => void
  }
}

export interface YouTubeApi {
  Player: new (element: HTMLElement, options: YouTubePlayerOptions) => YouTubePlayer
}

/** États renvoyés par `onStateChange`. */
export const YT_STATE = { ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 } as const

declare global {
  interface Window {
    YT?: YouTubeApi
    onYouTubeIframeAPIReady?: () => void
  }
}

const SCRIPT_SRC = 'https://www.youtube.com/iframe_api'

let apiPromise: Promise<YouTubeApi> | null = null

function loadApi(): Promise<YouTubeApi> {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (apiPromise) return apiPromise

  apiPromise = new Promise<YouTubeApi>((resolve, reject) => {
    // Le rappel est global et unique : on chaîne celui qui serait déjà posé
    // plutôt que de l'écraser.
    const previous = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      previous?.()
      if (window.YT?.Player) resolve(window.YT)
      else reject(new Error('API YouTube chargée sans lecteur'))
    }

    if (document.querySelector(`script[src="${SCRIPT_SRC}"]`)) return

    const script = document.createElement('script')
    script.src = SCRIPT_SRC
    script.async = true
    script.onerror = () => {
      // Une nouvelle tentative reste possible : bloqueur de contenu levé,
      // connexion revenue…
      apiPromise = null
      script.remove()
      reject(new Error('Script YouTube inaccessible'))
    }
    document.head.appendChild(script)
  })

  return apiPromise
}

export function useYouTubeApi() {
  return { load: loadApi }
}
