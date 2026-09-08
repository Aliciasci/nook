// Upload / removal of the user's full-screen background image.
//
// Images are downscaled in the browser before upload: a phone photo is
// routinely 6-12 MB, which is slow to send, slow to paint, and pointless for
// something that ends up behind a UI at screen resolution.
import { supabase } from '@/lib/supabase'
import { downscaleImage } from '@/utils/imageUpload'

const BUCKET = 'backgrounds'
const MAX_EDGE = 2560
const QUALITY = 0.82

export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024

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

  const blob = await downscaleImage(file, MAX_EDGE, QUALITY)
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
