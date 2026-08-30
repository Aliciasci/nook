import { computed, reactive } from 'vue'
import type { SpotifyConnectionStatus, SpotifyPlaybackState, SpotifyTrack } from '@/types'

const STORAGE_KEY = 'nook:spotify:v1'
const PKCE_VERIFIER_KEY = 'nook:spotify:pkce-verifier'
const PKCE_STATE_KEY = 'nook:spotify:pkce-state'

const SCOPES = 'user-read-currently-playing user-read-playback-state user-modify-playback-state'
const AUTHORIZE_URL = 'https://accounts.spotify.com/authorize'
const TOKEN_URL = 'https://accounts.spotify.com/api/token'
const API_BASE = 'https://api.spotify.com/v1'

// Set once by whoever deploys Nook (build-time env var) so every visitor of
// the deployed app can connect their own Spotify account without needing to
// register a Spotify app themselves. Falls back to a locally-entered Client ID
// (stored in localStorage) for local development without a .env file.
const ENV_CLIENT_ID = ((import.meta.env.VITE_SPOTIFY_CLIENT_ID as string | undefined) ?? '').trim()

function effectiveClientId(): string {
  return ENV_CLIENT_ID || persisted.clientId
}

interface Persisted {
  clientId: string
  accessToken: string | null
  refreshToken: string | null
  expiresAt: number | null
  focusPlaylistUri: string
}

function loadPersisted(): Persisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Persisted>
      return {
        clientId: parsed.clientId ?? '',
        accessToken: parsed.accessToken ?? null,
        refreshToken: parsed.refreshToken ?? null,
        expiresAt: parsed.expiresAt ?? null,
        focusPlaylistUri: parsed.focusPlaylistUri ?? '',
      }
    }
  } catch {
    // fall through to defaults
  }
  return { clientId: '', accessToken: null, refreshToken: null, expiresAt: null, focusPlaylistUri: '' }
}

const persisted = reactive<Persisted>(loadPersisted())

function savePersisted() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted))
}

const state = reactive<{
  status: SpotifyConnectionStatus
  playback: SpotifyPlaybackState | null
  errorMessage: string | null
}>({
  status: persisted.refreshToken ? 'connecting' : 'disconnected',
  playback: null,
  errorMessage: null,
})

let pollHandle: number | undefined
let tickHandle: number | undefined
let initialized = false

// --- PKCE helpers -----------------------------------------------------

function randomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(bytes, (b) => chars[b % chars.length]).join('')
}

function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let str = ''
  for (const byte of bytes) str += String.fromCharCode(byte)
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function codeChallengeFor(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return base64UrlEncode(digest)
}

function redirectUri(): string {
  return `${window.location.origin}/`
}

// --- Token management ---------------------------------------------------

function persistTokens(accessToken: string, refreshToken: string | null, expiresInSeconds: number) {
  persisted.accessToken = accessToken
  if (refreshToken) persisted.refreshToken = refreshToken
  persisted.expiresAt = Date.now() + expiresInSeconds * 1000
  savePersisted()
}

async function refreshAccessToken(): Promise<boolean> {
  const clientId = effectiveClientId()
  if (!persisted.refreshToken || !clientId) return false
  try {
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: persisted.refreshToken,
        client_id: clientId,
      }),
    })
    if (!res.ok) return false
    const data = await res.json()
    persistTokens(data.access_token, data.refresh_token ?? null, data.expires_in)
    return true
  } catch {
    return false
  }
}

async function ensureValidToken(): Promise<boolean> {
  if (!persisted.accessToken) return false
  const expiresSoon = !persisted.expiresAt || Date.now() > persisted.expiresAt - 60_000
  if (expiresSoon) return refreshAccessToken()
  return true
}

// --- Now playing ---------------------------------------------------------

function parseTrack(item: Record<string, unknown> | null): SpotifyTrack | null {
  if (!item) return null
  const album = item.album as Record<string, unknown> | undefined
  const artists = item.artists as Array<Record<string, unknown>> | undefined
  const images = (album?.images as Array<Record<string, unknown>>) ?? []
  return {
    id: item.id as string,
    name: item.name as string,
    artist: artists?.map((a) => a.name as string).join(', ') ?? '',
    albumName: (album?.name as string) ?? '',
    albumArtUrl: (images[0]?.url as string) ?? null,
    durationMs: (item.duration_ms as number) ?? 0,
  }
}

function resetConnection() {
  stopPolling()
  persisted.accessToken = null
  persisted.refreshToken = null
  persisted.expiresAt = null
  savePersisted()
  state.status = 'disconnected'
  state.playback = null
  state.errorMessage = null
}

async function fetchNowPlaying() {
  const ok = await ensureValidToken()
  if (!ok) {
    resetConnection()
    return
  }
  try {
    const res = await fetch(`${API_BASE}/me/player/currently-playing`, {
      headers: { Authorization: `Bearer ${persisted.accessToken}` },
    })
    if (res.status === 204) {
      state.playback = { track: null, isPlaying: false, progressMs: 0 }
      state.status = 'connected'
      return
    }
    if (res.status === 401) {
      const refreshed = await refreshAccessToken()
      if (!refreshed) resetConnection()
      return
    }
    if (!res.ok) {
      state.status = 'error'
      state.errorMessage = "Impossible de joindre Spotify pour l'instant."
      return
    }
    const data = await res.json()
    state.playback = {
      track: parseTrack(data.item ?? null),
      isPlaying: Boolean(data.is_playing),
      progressMs: data.progress_ms ?? 0,
    }
    state.status = 'connected'
    state.errorMessage = null
  } catch {
    state.status = 'error'
    state.errorMessage = 'Connexion à Spotify indisponible.'
  }
}

function startPolling() {
  stopPolling()
  fetchNowPlaying()
  pollHandle = window.setInterval(() => {
    if (!document.hidden) fetchNowPlaying()
  }, 10_000)
  tickHandle = window.setInterval(() => {
    if (state.playback?.isPlaying && state.playback.track) {
      state.playback.progressMs = Math.min(state.playback.track.durationMs, state.playback.progressMs + 1000)
    }
  }, 1000)
}

function stopPolling() {
  if (pollHandle !== undefined) window.clearInterval(pollHandle)
  if (tickHandle !== undefined) window.clearInterval(tickHandle)
  pollHandle = undefined
  tickHandle = undefined
}

// --- Public API ------------------------------------------------------

export function useSpotify() {
  const isConfigured = computed(() => effectiveClientId().length > 0)
  const isClientIdFromEnv = computed(() => ENV_CLIENT_ID.length > 0)

  async function connect() {
    if (!isConfigured.value) return
    const verifier = randomString(64)
    const challenge = await codeChallengeFor(verifier)
    const oauthState = randomString(16)
    sessionStorage.setItem(PKCE_VERIFIER_KEY, verifier)
    sessionStorage.setItem(PKCE_STATE_KEY, oauthState)

    const params = new URLSearchParams({
      client_id: effectiveClientId(),
      response_type: 'code',
      redirect_uri: redirectUri(),
      code_challenge_method: 'S256',
      code_challenge: challenge,
      scope: SCOPES,
      state: oauthState,
    })
    window.location.href = `${AUTHORIZE_URL}?${params.toString()}`
  }

  function disconnect() {
    resetConnection()
  }

  async function handleRedirectCallback() {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const returnedState = params.get('state')
    const error = params.get('error')

    if (!code && !error) return

    const cleanUrl = window.location.pathname
    window.history.replaceState({}, '', cleanUrl)

    if (error) {
      state.status = 'error'
      state.errorMessage = 'Connexion Spotify refusée.'
      return
    }

    const expectedState = sessionStorage.getItem(PKCE_STATE_KEY)
    const verifier = sessionStorage.getItem(PKCE_VERIFIER_KEY)
    sessionStorage.removeItem(PKCE_STATE_KEY)
    sessionStorage.removeItem(PKCE_VERIFIER_KEY)

    if (!code || !verifier || returnedState !== expectedState) return

    state.status = 'connecting'
    try {
      const res = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri(),
          client_id: effectiveClientId(),
          code_verifier: verifier,
        }),
      })
      if (!res.ok) throw new Error('token exchange failed')
      const data = await res.json()
      persistTokens(data.access_token, data.refresh_token ?? null, data.expires_in)
      startPolling()
    } catch {
      state.status = 'error'
      state.errorMessage = 'La connexion à Spotify a échoué.'
    }
  }

  function init() {
    if (initialized) return
    initialized = true
    handleRedirectCallback().then(() => {
      if (persisted.refreshToken && state.status !== 'connected') startPolling()
    })
  }

  async function callPlaybackAction(path: string, method: 'PUT' | 'POST') {
    const ok = await ensureValidToken()
    if (!ok) return
    try {
      await fetch(`${API_BASE}/me/player/${path}`, {
        method,
        headers: { Authorization: `Bearer ${persisted.accessToken}` },
      })
      window.setTimeout(fetchNowPlaying, 400)
    } catch {
      // Playback controls require Premium + an active device; fail quietly
      // and let the next poll reconcile the true state.
    }
  }

  function play() {
    return callPlaybackAction('play', 'PUT')
  }
  function pause() {
    return callPlaybackAction('pause', 'PUT')
  }
  function next() {
    return callPlaybackAction('next', 'POST')
  }
  function previous() {
    return callPlaybackAction('previous', 'POST')
  }

  function setClientId(value: string) {
    persisted.clientId = value.trim()
    savePersisted()
  }

  function setFocusPlaylistUri(value: string) {
    persisted.focusPlaylistUri = value.trim()
    savePersisted()
  }

  // Architecture hook for a future "Focus playlist": starts playback of the
  // configured context_uri. Not called anywhere yet — Focus Mode never
  // triggers playback automatically, per product decision.
  async function playFocusPlaylist() {
    if (!persisted.focusPlaylistUri) return
    const ok = await ensureValidToken()
    if (!ok) return
    try {
      await fetch(`${API_BASE}/me/player/play`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${persisted.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ context_uri: persisted.focusPlaylistUri }),
      })
    } catch {
      // silent — see callPlaybackAction
    }
  }

  return {
    state,
    isConfigured,
    isClientIdFromEnv,
    clientId: computed(() => effectiveClientId()),
    focusPlaylistUri: computed(() => persisted.focusPlaylistUri),
    redirectUri: redirectUri(),
    init,
    connect,
    disconnect,
    play,
    pause,
    next,
    previous,
    setClientId,
    setFocusPlaylistUri,
    playFocusPlaylist,
  }
}
