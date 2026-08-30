/**
 * Motifs de fond — de petits dessins répétés par-dessus une couleur unie.
 *
 * Chaque motif est un SVG construit ici puis passé en `data:` URI. Il est
 * construit *en JavaScript* et non écrit en CSS parce qu'un SVG en `data:`
 * n'hérite d'aucune variable CSS : sa couleur doit y être inscrite en clair.
 * `useBackground` la lui donne au moment d'appliquer, en lisant la teinte du
 * thème actif — c'est ainsi que le motif suit les thèmes, clairs comme sombres.
 */

export type BackgroundPattern = 'flowers' | 'moons' | 'stars'

export const BACKGROUND_PATTERNS: { id: BackgroundPattern; label: string }[] = [
  { id: 'flowers', label: 'Fleurs' },
  { id: 'moons', label: 'Lunes' },
  { id: 'stars', label: 'Étoiles' },
]

/** Côté de la tuile, en pixels. Deux motifs par tuile, en quinconce. */
const TILE = 72

/** Fleur à cinq pétales, vue de face. */
function flower(cx: number, cy: number, r: number): string {
  const petals = Array.from({ length: 5 }, (_, i) => {
    const a = (i * 2 * Math.PI) / 5 - Math.PI / 2
    return `<ellipse cx="${(cx + Math.cos(a) * r * 0.62).toFixed(2)}" cy="${(cy + Math.sin(a) * r * 0.62).toFixed(2)}" rx="${(r * 0.42).toFixed(2)}" ry="${(r * 0.58).toFixed(2)}" transform="rotate(${((a * 180) / Math.PI + 90).toFixed(1)} ${(cx + Math.cos(a) * r * 0.62).toFixed(2)} ${(cy + Math.sin(a) * r * 0.62).toFixed(2)})"/>`
  }).join('')
  return `${petals}<circle cx="${cx}" cy="${cy}" r="${(r * 0.3).toFixed(2)}"/>`
}

/**
 * Croissant : un disque évidé par un second, décalé.
 *
 * Deux cercles et `fill-rule="evenodd"` plutôt que deux arcs : le second arc
 * devrait couvrir une corde égale au diamètre du premier, ce qu'un rayon plus
 * petit ne peut pas faire — SVG l'agrandit alors d'office et les deux arcs se
 * superposent, ne laissant aucune aire.
 */
function circle(cx: number, cy: number, r: number): string {
  return `M ${cx - r} ${cy} a ${r} ${r} 0 1 0 ${2 * r} 0 a ${r} ${r} 0 1 0 ${-2 * r} 0 Z`
}

function moon(cx: number, cy: number, r: number): string {
  return `<path fill-rule="evenodd" d="${circle(cx, cy, r)} ${circle(cx + r * 0.46, cy - r * 0.12, r * 0.9)}"/>`
}

/** Étoile à quatre branches, aux flancs creusés. */
function star(cx: number, cy: number, r: number): string {
  const i = r * 0.24
  return `<path d="M ${cx} ${cy - r} Q ${cx + i} ${cy - i} ${cx + r} ${cy} Q ${cx + i} ${cy + i} ${cx} ${cy + r} Q ${cx - i} ${cy + i} ${cx - r} ${cy} Q ${cx - i} ${cy - i} ${cx} ${cy - r} Z"/>`
}

const SHAPES: Record<BackgroundPattern, (cx: number, cy: number, r: number) => string> = {
  flowers: flower,
  moons: moon,
  stars: star,
}

/**
 * L'URI d'un motif, dessiné dans `color`.
 *
 * Deux exemplaires par tuile, décalés en quinconce et de tailles légèrement
 * différentes : une grille parfaitement régulière se lit comme une trame et
 * attire l'œil, ce qu'un fond ne doit jamais faire.
 */
export function patternDataUri(pattern: BackgroundPattern, color: string): string {
  const draw = SHAPES[pattern]
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${TILE}" height="${TILE}" viewBox="0 0 ${TILE} ${TILE}">` +
    `<g fill="${color}">` +
    draw(TILE * 0.26, TILE * 0.26, TILE * 0.115) +
    draw(TILE * 0.74, TILE * 0.72, TILE * 0.085) +
    `</g></svg>`
  // Seuls `#` et `<`/`>` posent problème dans une `url()` ; encoder l'ensemble
  // reste le plus sûr et coûte quelques octets.
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}

export const PATTERN_TILE_PX = TILE
