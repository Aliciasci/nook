// Upload / retrait des images posées sur un vision board — même mécanique que
// `services/backgrounds.ts`, un bucket à part.
import { supabase } from '@/lib/supabase'
import { downscaleImage, loadImage } from '@/utils/imageUpload'

const BUCKET = 'vision-boards'
const MAX_EDGE = 1920
const QUALITY = 0.82

export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024

export interface UploadedVisionBoardImage {
  url: string
  path: string
  /** Dimensions réelles de l'image envoyée — sert à poser la carte à son
   *  format plutôt qu'un carré par défaut. Absentes si la mesure a échoué,
   *  ce qui ne doit pas empêcher l'envoi. */
  naturalWidth?: number
  naturalHeight?: number
}

/** Downscale, envoi dans le bucket, et URL publique — commun aux deux origines. */
async function finishUpload(source: Blob, extFallback: string): Promise<UploadedVisionBoardImage> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Tu dois être connectée pour ajouter une image.')

  const blob = await downscaleImage(source, MAX_EDGE, QUALITY)
  if (blob.size > MAX_UPLOAD_BYTES) {
    throw new Error("L'image reste trop lourde après compression (max 5 Mo).")
  }

  // Mesurée sur le fichier final : c'est lui qui s'affiche, et la mesure ne
  // coûte rien (décodage local, aucun aller-réseau).
  const dimensions = await loadImage(blob)
    .then((img) => ({ naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight }))
    .catch(() => ({ naturalWidth: undefined, naturalHeight: undefined }))

  const ext = blob.type === 'image/webp' ? 'webp' : extFallback
  const path = `${user.id}/${crypto.randomUUID()}.${ext}`

  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: blob.type,
    cacheControl: '31536000',
    upsert: false,
  })
  if (error) throw error

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return { url: data.publicUrl, path, ...dimensions }
}

export async function uploadVisionBoardImage(file: File): Promise<UploadedVisionBoardImage> {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    throw new Error('Formats acceptés : JPEG, PNG, WebP ou AVIF.')
  }
  return finishUpload(file, file.name.split('.').pop() ?? 'jpg')
}

/**
 * Récupère une image depuis son URL directe — typiquement copiée depuis
 * Pinterest (« Copier l'adresse de l'image »), ou n'importe quel autre site.
 *
 * Ne marche que si l'hôte de l'image autorise les requêtes cross-origin
 * (`fetch` respecte CORS, contrairement à une balise `<img>`) : les CDN
 * d'images le font en général, une page web classique non. Le lien d'un pin
 * Pinterest (`pinterest.com/pin/...`) ne marche donc pas ici — il faudrait
 * passer par un serveur pour lire sa page et en extraire l'image.
 */
export async function uploadVisionBoardImageFromUrl(url: string): Promise<UploadedVisionBoardImage> {
  let response: Response
  try {
    response = await fetch(url, { mode: 'cors' })
  } catch {
    throw new Error("Ce lien ne peut pas être récupéré depuis le navigateur — colle plutôt l'adresse directe de l'image.")
  }
  if (!response.ok) throw new Error("Impossible de récupérer cette image (lien invalide ou inaccessible).")

  const blob = await response.blob()
  if (!ACCEPTED_TYPES.includes(blob.type)) {
    throw new Error("Ce lien ne pointe pas vers une image JPEG, PNG, WebP ou AVIF.")
  }

  return finishUpload(blob, blob.type.split('/')[1] ?? 'jpg')
}

/**
 * Termine l'envoi d'une image déjà récupérée ailleurs — la fonction Edge
 * `extract-pin-image` renvoie directement les octets, il n'y a plus qu'à les
 * poser dans le bucket.
 */
export async function uploadVisionBoardImageBlob(blob: Blob): Promise<UploadedVisionBoardImage> {
  if (!ACCEPTED_TYPES.includes(blob.type)) {
    throw new Error('Formats acceptés : JPEG, PNG, WebP ou AVIF.')
  }
  return finishUpload(blob, blob.type.split('/')[1] ?? 'jpg')
}

/** Best-effort cleanup, comme pour les fonds d'écran : jamais bloquant. */
export async function removeVisionBoardImage(path: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([path])
  if (error) console.warn('[Nook] vision board image cleanup failed (non-blocking):', error.message)
}
