import type { FolderColor } from '@/types'

/**
 * La teinte d'un créneau, résolue en valeurs CSS.
 *
 * Une teinte est soit **un des six noms de l'app** (`blue`, `green`…), soit
 * **une couleur libre** en `#rrggbb` — la même convention que le fond
 * d'écran, qui accepte déjà les deux dans un seul champ texte.
 *
 * Pourquoi des valeurs CSS et pas des classes Tailwind comme
 * `useFolderColor` : une couleur libre n'a pas de classe. Le planning peint
 * donc par variables (`--blk-bg`, `--blk-ink`…) posées en style, et les six
 * teintes s'y écrivent `var(--color-folder-X)` — elles continuent de suivre
 * le thème actif, en clair comme en sombre, sans rien recalculer.
 */
export interface ActivityPalette {
  /** Le fond pastel de la carte. */
  bg: string
  /** L'encre : titre, icône, heures. */
  ink: string
  /** Le filet autour de la carte. */
  ring: string
  /** L'aplat saturé : le trait de gauche, les pastilles, les parts du camembert. */
  solid: string
}

export const TINTS: FolderColor[] = ['blue', 'green', 'pink', 'beige', 'lavender', 'peach']

export const TINT_LABELS: Record<FolderColor, string> = {
  blue: 'Bleu',
  green: 'Vert',
  pink: 'Rose',
  beige: 'Beige',
  lavender: 'Lavande',
  peach: 'Pêche',
}

export function isTint(color: string): color is FolderColor {
  return (TINTS as string[]).includes(color)
}

export function isFreeColor(color: string | null | undefined): boolean {
  return typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color)
}

/** La teinte d'un créneau sans couleur : neutre, mais pas incolore. */
const NEUTRAL: ActivityPalette = {
  bg: 'var(--color-lavender-50)',
  ink: 'var(--color-ink)',
  ring: 'color-mix(in srgb, var(--color-ink) 8%, transparent)',
  solid: 'var(--color-lavender-400)',
}

function tintPalette(tint: FolderColor): ActivityPalette {
  const fill = `var(--color-folder-${tint})`
  const ink = `var(--color-folder-${tint}-ink)`
  return {
    bg: fill,
    ink,
    ring: `color-mix(in srgb, ${ink} 15%, transparent)`,
    solid: `color-mix(in srgb, ${ink} 85%, transparent)`,
  }
}

/* ------------------------------------------------------ Couleur libre --- */

function hexToHsl(hex: string): { h: number; s: number; l: number } | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  const n = parseInt(m[1], 16)
  const r = ((n >> 16) & 255) / 255
  const g = ((n >> 8) & 255) / 255
  const b = (n & 255) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  if (d === 0) return { h: 0, s: 0, l }
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h: number
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
  else if (max === g) h = ((b - r) / d + 2) / 6
  else h = ((r - g) / d + 4) / 6
  return { h: h * 360, s, l }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/**
 * Une couleur libre devient un pastel de sa teinte, pas l'aplat choisi.
 *
 * C'est la différence avec le fond d'écran, où la couleur choisie est peinte
 * telle quelle : une carte de planning **porte du texte**. Un turquoise saturé
 * pris au nuancier donnerait un titre illisible, et surtout une carte qui
 * jurerait au milieu des six autres. On ne garde donc que la *teinte* — la
 * saturation et la clarté sont ramenées dans la fourchette des six couleurs de
 * Nook, relevée sur elles : fond très clair, encre à mi-hauteur.
 *
 * Conséquence assumée : deux turquoise voisins donnent la même carte. C'est le
 * prix de la douceur, et personne ne planifie sa semaine au nuancier près.
 */
function freePalette(hex: string): ActivityPalette {
  const hsl = hexToHsl(hex)
  if (!hsl) return NEUTRAL
  const { h, s } = hsl
  const bg = `hsl(${h.toFixed(0)} ${(clamp(s, 0.45, 0.85) * 100).toFixed(0)}% 92%)`
  const ink = `hsl(${h.toFixed(0)} ${(clamp(s, 0.32, 0.55) * 100).toFixed(0)}% 45%)`
  return {
    bg,
    ink,
    ring: `color-mix(in srgb, ${ink} 15%, transparent)`,
    solid: `color-mix(in srgb, ${ink} 85%, transparent)`,
  }
}

/** `null` — aucune teinte — donne la palette neutre, jamais rien du tout. */
export function resolvePalette(color: string | null | undefined): ActivityPalette {
  if (!color) return NEUTRAL
  if (isTint(color)) return tintPalette(color)
  if (isFreeColor(color)) return freePalette(color)
  return NEUTRAL
}
