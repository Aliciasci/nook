// Downscale d'une image côté navigateur avant envoi — partagé par le fond
// d'écran (`services/backgrounds.ts`) et les images de vision board
// (`services/visionBoardImages.ts`). Une photo de téléphone pèse couramment
// 6-12 Mo : lent à envoyer, lent à peindre, et inutile pour un visuel qui finit
// affiché à une fraction de sa résolution native.

export function loadImage(file: Blob): Promise<HTMLImageElement> {
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

/** Downscale so the longest edge is at most `maxEdge`, re-encoding to WebP. */
export async function downscaleImage(file: Blob, maxEdge: number, quality: number): Promise<Blob> {
  const img = await loadImage(file)
  const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight))

  // Already small enough and in a compact format — send the original rather
  // than re-encoding it (which would only lose quality).
  if (scale === 1 && (file.type === 'image/webp' || file.type === 'image/avif')) return file

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.naturalWidth * scale)
  canvas.height = Math.round(img.naturalHeight * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) return file
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', quality))
  return blob ?? file
}
