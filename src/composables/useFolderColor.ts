import type { FolderColor } from '@/types'

interface FolderPalette {
  bg: string
  bgSoft: string
  ink: string
  ring: string
  tab: string
  /** Saturated fill of the folder's color. For small marks — a sidebar dot at
   *  10px is too little surface to read in the pastel `bg` tone. Held just shy
   *  of full ink so it reads as a colored mark rather than a hard bullet. */
  solid: string
}

const PALETTES: Record<FolderColor, FolderPalette> = {
  blue: { bg: 'bg-folder-blue', bgSoft: 'bg-folder-blue/40', ink: 'text-folder-blue-ink', ring: 'ring-folder-blue-ink/15', tab: 'bg-folder-blue-ink/25', solid: 'bg-folder-blue-ink/85' },
  green: { bg: 'bg-folder-green', bgSoft: 'bg-folder-green/40', ink: 'text-folder-green-ink', ring: 'ring-folder-green-ink/15', tab: 'bg-folder-green-ink/25', solid: 'bg-folder-green-ink/85' },
  pink: { bg: 'bg-folder-pink', bgSoft: 'bg-folder-pink/40', ink: 'text-folder-pink-ink', ring: 'ring-folder-pink-ink/15', tab: 'bg-folder-pink-ink/25', solid: 'bg-folder-pink-ink/85' },
  beige: { bg: 'bg-folder-beige', bgSoft: 'bg-folder-beige/40', ink: 'text-folder-beige-ink', ring: 'ring-folder-beige-ink/15', tab: 'bg-folder-beige-ink/25', solid: 'bg-folder-beige-ink/85' },
  lavender: { bg: 'bg-folder-lavender', bgSoft: 'bg-folder-lavender/40', ink: 'text-folder-lavender-ink', ring: 'ring-folder-lavender-ink/15', tab: 'bg-folder-lavender-ink/25', solid: 'bg-folder-lavender-ink/85' },
  peach: { bg: 'bg-folder-peach', bgSoft: 'bg-folder-peach/40', ink: 'text-folder-peach-ink', ring: 'ring-folder-peach-ink/15', tab: 'bg-folder-peach-ink/25', solid: 'bg-folder-peach-ink/85' },
}

export function useFolderColor(color: FolderColor): FolderPalette {
  return PALETTES[color]
}
