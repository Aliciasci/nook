// Récupération d'une image Pinterest — passe par la fonction Edge
// `extract-pin-image` (voir `supabase/functions/extract-pin-image`), le
// navigateur ne pouvant récupérer ni la page d'un pin ni son image en direct
// depuis le CDN de Pinterest (CORS dans les deux cas).
import { supabase } from '@/lib/supabase'

/** Lien de pin, raccourci `pin.it`, ou image directe sur le CDN Pinterest. */
export function isPinterestUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url)
    return (
      /(^|\.)pinterest\.[a-z.]+$/i.test(hostname) ||
      /^pin\.it$/i.test(hostname) ||
      /(^|\.)pinimg\.com$/i.test(hostname)
    )
  } catch {
    return false
  }
}

interface ExtractResponse {
  imageBase64?: string
  contentType?: string
  error?: string
}

function base64ToBlob(base64: string, contentType: string): Blob {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: contentType })
}

export async function fetchPinterestImage(url: string): Promise<Blob> {
  const { data, error } = await supabase.functions.invoke<ExtractResponse>('extract-pin-image', {
    body: { url },
  })
  if (error) {
    throw new Error(
      "Le service d'extraction Pinterest n'a pas répondu — a-t-il bien été déployé sur ce projet Supabase ?",
    )
  }
  if (!data?.imageBase64 || !data.contentType) throw new Error(data?.error ?? "Aucune image trouvée sur ce pin.")
  return base64ToBlob(data.imageBase64, data.contentType)
}
