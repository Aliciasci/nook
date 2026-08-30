// Upload / removal of the user's full-screen background image.
//
// Images are downscaled in the browser before upload: a phone photo is
// routinely 6-12 MB, which is slow to send, slow to paint, and pointless for
// something that ends up behind a UI at screen resolution.
import { supabase } from '@/lib/supabase'

const BUCKET = 'backgrounds'
const MAX_EDGE = 2560
const QUALITY = 0.82

export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("Ce fichier n'est pas une image lisible."))
    }
    img.src = url
  })
}

/** Downscale so the longest edge is at most MAX_EDGE, re-encoding to WebP. */
async function downscale(file: File): Promise<Blob> {
  const img = await loadImage(file)
  const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight))

  // Already small enough and in a compact format — send the original rather
  // than re-encoding it (which would only lose quality).
  if (scale === 1 && (file.type === 'image/webp' || file.type === 'image/avif')) return file

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.naturalWidth * scale)
  canvas.height = Math.round(img.naturalHeight * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) return file
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/webp', QUALITY),
  )
  return blob ?? file
}

export interface UploadedBackground {
  url: string
  path: string
}

export async function uploadBackground(file: File): Promise<UploadedBackground> {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    throw new Error('Formats acceptés : JPEG, PNG, WebP ou AVIF.')
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Tu dois être connectée pour envoyer une image.')

  const blob = await downscale(file)
  if (blob.size > MAX_UPLOAD_BYTES) {
    throw new Error("L'image reste trop lourde après compression (max 5 Mo).")
  }

  const ext = blob.type === 'image/webp' ? 'webp' : (file.name.split('.').pop() ?? 'jpg')
  const path = `${user.id}/${crypto.randomUUID()}.${ext}`

  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: blob.type,
    cacheControl: '31536000',
    upsert: false,
  })
  if (error) throw error

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return { url: data.publicUrl, path }
}

/** Best-effort cleanup: a failure here must never block changing the wallpaper.
 *  .remove() reports failures in its result rather than throwing, so the error
 *  has to be read explicitly — otherwise a rejected delete is indistinguishable
 *  from a successful one and orphaned files pile up in the user's quota. */
export async function removeBackground(path: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([path])
  if (error) console.warn('[Nook] background cleanup failed (non-blocking):', error.message)
}
