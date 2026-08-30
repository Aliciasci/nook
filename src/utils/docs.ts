// Rendu et transformations du contenu des pages de documentation.
//
// Un bloc stocke du texte brut avec ses marqueurs (`**gras**`, `[[Page]]`…).
// L'éditeur affiche ce texte brut pendant la frappe et son rendu le reste du
// temps, d'où `formatInline` qui renvoie aussi la correspondance entre les
// deux : sans elle, cliquer au milieu d'un paragraphe rendu ne saurait pas où
// placer le curseur dans le texte source.
import type { DocBlock, DocBlockType, DocPage, DocPageNode } from '@/types'

/** Minuscules sans accents — pour comparer ou filtrer du texte saisi. */
export function foldText(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export interface InlineRender {
  html: string
  /** Texte rendu, sans les marqueurs. */
  plain: string
  /**
   * `map[i]` = index dans le texte brut du i-ème caractère du texte rendu.
   * Contient une entrée de plus que le texte rendu, pour un curseur placé
   * tout à la fin.
   */
  map: number[]
}

export type InlineMark = 'bold' | 'italic' | 'underline' | 'strike' | 'code'

/** Marqueur encadrant chaque style, tel qu'il est stocké dans le texte. */
export const INLINE_MARKERS: Record<InlineMark, string> = {
  bold: '**',
  italic: '*',
  underline: '++',
  strike: '~~',
  code: '`',
}

/**
 * Couleurs de texte. Ce sont celles des dossiers : chaque thème les redéfinit
 * déjà, en clair comme en sombre, donc une page colorée reste lisible partout.
 * `hex` ne sert qu'à l'export Markdown, qui n'a pas accès aux variables CSS —
 * à l'écran c'est le thème courant qui décide de la teinte.
 */
export type DocTextColor = 'blue' | 'green' | 'pink' | 'beige' | 'lavender' | 'peach'

export const DOC_TEXT_COLORS: { id: DocTextColor; label: string; hex: string }[] = [
  { id: 'blue', label: 'Bleu', hex: '#4d6ba6' },
  { id: 'green', label: 'Vert', hex: '#43876a' },
  { id: 'pink', label: 'Rose', hex: '#b15d80' },
  { id: 'beige', label: 'Beige', hex: '#9a7448' },
  { id: 'lavender', label: 'Lavande', hex: '#6d55b8' },
  { id: 'peach', label: 'Pêche', hex: '#b6683f' },
]

const COLOR_IDS = DOC_TEXT_COLORS.map((color) => color.id).join('|')

/** `{blue|texte}` — le contenu exclut les accolades, donc pas d'imbrication. */
const COLOR_SOURCE = `\\{(${COLOR_IDS})\\|([^{}]+)\\}`

// Ordre important : les alternatives sont essayées de gauche à droite à chaque
// position, donc `***gras italique***` avant `**gras**` avant `*italique*`.
// Le `(?!\*)` après la fermeture du gras évite qu'un `**gras et *penché***`
// se ferme sur les deux premières étoiles des trois et laisse une orpheline.
// Les contenus sont paresseux (`.+?`) pour autoriser l'imbrication : ils sont
// re-rendus récursivement, sauf le code qui reste littéral.
const INLINE_RE = new RegExp(
  /\[\[([^[\]]+)\]\]|\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*(?!\*)|__(.+?)__|\+\+(.+?)\+\+|~~(.+?)~~|`([^`]+)`|\*(.+?)\*|\[([^[\]]+)\]\(([^()\s]+)\)/
    .source + `|${COLOR_SOURCE}`,
  'g',
)

/** Seuls ces schémas deviennent des liens cliquables — jamais `javascript:`. */
function safeHref(url: string): string | null {
  const trimmed = url.trim()
  if (/^https?:\/\//i.test(trimmed) || /^mailto:/i.test(trimmed)) return trimmed
  if (trimmed.startsWith('/')) return trimmed
  return null
}

export interface InlineOptions {
  /**
   * Rendre `[[Titre]]` comme un lien vers une page de documentation.
   *
   * Vrai dans la doc, faux partout ailleurs : le moteur de formatage sert
   * aussi aux notes, où le clic sur un tel lien ne mènerait nulle part. Un
   * lien inerte qui a l'air d'un lien vaut moins que du texte brut.
   */
  wikiLinks?: boolean
}

function renderInline(raw: string, offset: number, opts: InlineOptions): InlineRender {
  let html = ''
  let plain = ''
  const map: number[] = []

  function appendPlain(text: string, rawStart: number) {
    for (let i = 0; i < text.length; i++) map.push(rawStart + i)
    plain += text
    html += escapeHtml(text)
  }

  /** Contenu re-rendu : c'est ce qui permet `**gras avec `code` dedans**`. */
  function appendNested(open: string, content: string, contentStart: number, close: string) {
    const inner = renderInline(content, contentStart, opts)
    html += open + inner.html + close
    plain += inner.plain
    // La dernière entrée d'un rendu est la position « fin de texte » : elle
    // n'a de sens qu'au niveau le plus haut.
    for (let i = 0; i < inner.map.length - 1; i++) map.push(inner.map[i])
  }

  let cursor = 0
  const re = new RegExp(INLINE_RE.source, 'g')
  let match: RegExpExecArray | null
  while ((match = re.exec(raw)) !== null) {
    if (match.index > cursor) appendPlain(raw.slice(cursor, match.index), offset + cursor)

    // prettier-ignore
    const [full, wiki, boldItalic, bold, boldUnderscore, underline, strike, code,
           italic, linkText, linkUrl, colorId, colorText] = match
    const start = offset + match.index

    if (wiki !== undefined && opts.wikiLinks === false) {
      // Hors de la doc : le texte source, tel quel.
      appendPlain(full, start)
    } else if (wiki !== undefined) {
      appendNested(
        `<a class="doc-wiki" data-wiki="${escapeHtml(wiki.trim())}" role="link" tabindex="-1">`,
        wiki,
        start + 2,
        '</a>',
      )
    } else if (boldItalic !== undefined) {
      appendNested('<strong><em>', boldItalic, start + 3, '</em></strong>')
    } else if (bold !== undefined) {
      appendNested('<strong>', bold, start + 2, '</strong>')
    } else if (boldUnderscore !== undefined) {
      appendNested('<strong>', boldUnderscore, start + 2, '</strong>')
    } else if (underline !== undefined) {
      appendNested('<u>', underline, start + 2, '</u>')
    } else if (strike !== undefined) {
      appendNested('<s>', strike, start + 2, '</s>')
    } else if (code !== undefined) {
      // Le code ne contient pas de formatage : son contenu reste littéral.
      html += '<code class="doc-code-inline">'
      appendPlain(code, start + 1)
      html += '</code>'
    } else if (italic !== undefined) {
      appendNested('<em>', italic, start + 1, '</em>')
    } else if (linkText !== undefined && linkUrl !== undefined) {
      const href = safeHref(linkUrl)
      if (href) {
        appendNested(
          `<a class="doc-link" href="${escapeHtml(href)}" target="_blank" rel="noreferrer noopener" tabindex="-1">`,
          linkText,
          start + 1,
          '</a>',
        )
      } else {
        // Schéma refusé : on laisse le texte source tel quel, sans lien.
        appendPlain(full, start)
      }
    } else if (colorId !== undefined && colorText !== undefined) {
      // `colorId` vient d'une liste fermée : rien à échapper dans la classe.
      appendNested(
        `<span class="doc-color-${colorId}">`,
        colorText,
        start + colorId.length + 2,
        '</span>',
      )
    }

    cursor = match.index + full.length
  }

  if (cursor < raw.length) appendPlain(raw.slice(cursor), offset + cursor)
  map.push(offset + raw.length)

  return { html, plain, map }
}

export function formatInline(raw: string, opts: InlineOptions = { wikiLinks: true }): InlineRender {
  return renderInline(raw, 0, opts)
}

/** Texte rendu (sans marqueurs) d'un bloc — pour la recherche et le sommaire. */
export function blockPlainText(block: DocBlock): string {
  if (block.type === 'divider') return ''
  if (block.type === 'code') return block.text
  return formatInline(block.text).plain
}

export function pagePlainText(page: DocPage): string {
  return page.blocks.map(blockPlainText).filter(Boolean).join('\n')
}

/* ------------------------------------------------- Appliquer un style --- */

export interface MarkResult {
  text: string
  selectionStart: number
  selectionEnd: number
}

/** Longueur de la suite de `char` en fin de chaîne. */
function trailingRun(value: string, char: string): number {
  let n = 0
  while (n < value.length && value[value.length - 1 - n] === char) n++
  return n
}

/** Longueur de la suite de `char` en début de chaîne. */
function leadingRun(value: string, char: string): number {
  let n = 0
  while (n < value.length && value[n] === char) n++
  return n
}

/**
 * Pose ou retire un marqueur autour de la sélection. Renvoie le nouveau texte
 * et la sélection à restaurer — la fonction ne touche pas au DOM.
 */
export function toggleMark(value: string, start: number, end: number, mark: InlineMark): MarkResult {
  const marker = INLINE_MARKERS[mark]
  const before = value.slice(0, start)
  const selected = value.slice(start, end)
  const after = value.slice(end)

  // L'italique partage son étoile avec le gras : c'est la *parité* de la suite
  // d'étoiles qui dit s'il y a un italique à retirer. `**gras**` → 2, rien à
  // retirer ; `***gras italique***` → 3, une étoile de chaque côté part.
  const parityRule = mark === 'italic'
  const wraps = (lead: number, trail: number, plain: boolean) =>
    parityRule ? lead % 2 === 1 && trail % 2 === 1 : plain

  // 1. les marqueurs sont dans la sélection → on les retire
  if (
    selected.length >= 2 * marker.length &&
    wraps(
      leadingRun(selected, marker[0]),
      trailingRun(selected, marker[0]),
      selected.startsWith(marker) && selected.endsWith(marker),
    )
  ) {
    const inner = selected.slice(marker.length, selected.length - marker.length)
    return { text: before + inner + after, selectionStart: start, selectionEnd: start + inner.length }
  }

  // 2. les marqueurs encadrent la sélection → on les retire aussi
  if (
    wraps(
      trailingRun(before, marker[0]),
      leadingRun(after, marker[0]),
      before.endsWith(marker) && after.startsWith(marker),
    )
  ) {
    return {
      text: before.slice(0, -marker.length) + selected + after.slice(marker.length),
      selectionStart: start - marker.length,
      selectionEnd: end - marker.length,
    }
  }

  // 3. sinon on entoure — sélection vide : le curseur se place entre les deux
  return {
    text: before + marker + selected + marker + after,
    selectionStart: start + marker.length,
    selectionEnd: end + marker.length,
  }
}

/** Transforme la sélection en lien, curseur placé dans l'URL à compléter. */
export function insertLink(value: string, start: number, end: number): MarkResult {
  const label = value.slice(start, end) || 'texte'
  const text = `${value.slice(0, start)}[${label}](url)${value.slice(end)}`
  const urlStart = start + label.length + 3
  return { text, selectionStart: urlStart, selectionEnd: urlStart + 3 }
}

const COLOR_WRAP_RE = new RegExp(`^${COLOR_SOURCE}$`)
const COLOR_OPEN_RE = new RegExp(`\\{(${COLOR_IDS})\\|$`)

/**
 * Colore la sélection, ou la décolore : `color` à `null`, ou la couleur déjà
 * posée, retire le marqueur. Comme `toggleMark`, ne touche pas au DOM et rend
 * la sélection à restaurer.
 */
export function applyTextColor(
  value: string,
  start: number,
  end: number,
  color: DocTextColor | null,
): MarkResult {
  const before = value.slice(0, start)
  const selected = value.slice(start, end)
  const after = value.slice(end)

  const wrap = (id: DocTextColor, inner: string) => `{${id}|${inner}}`

  // 1. la sélection contient déjà le marqueur — `{blue|texte}` sélectionné en
  //    entier, ce qui arrive juste après l'avoir posé.
  const inside = selected.match(COLOR_WRAP_RE)
  if (inside) {
    const [, id, inner] = inside
    if (color === null || color === id) {
      return { text: before + inner + after, selectionStart: start, selectionEnd: start + inner.length }
    }
    const recolored = wrap(color, inner)
    return { text: before + recolored + after, selectionStart: start, selectionEnd: start + recolored.length }
  }

  // 2. le marqueur encadre la sélection — le cas courant : on a cliqué dans un
  //    passage déjà coloré et on change (ou retire) sa couleur.
  const open = before.match(COLOR_OPEN_RE)
  if (open && after.startsWith('}')) {
    const head = before.slice(0, -open[0].length)
    if (color === null || color === open[1]) {
      return {
        text: head + selected + after.slice(1),
        selectionStart: start - open[0].length,
        selectionEnd: end - open[0].length,
      }
    }
    const marker = `{${color}|`
    const shift = marker.length - open[0].length
    return {
      text: head + marker + selected + after,
      selectionStart: start + shift,
      selectionEnd: end + shift,
    }
  }

  // 3. rien à décolorer, et pas de couleur demandée : on ne touche à rien.
  if (color === null) return { text: value, selectionStart: start, selectionEnd: end }

  // Le contenu ne peut pas contenir d'accolade — les siennes casseraient le
  // marqueur — donc on les retire plutôt que d'écrire un texte irrécupérable.
  const inner = selected.replace(/[{}]/g, '')
  return {
    text: before + wrap(color, inner) + after,
    selectionStart: start + color.length + 2,
    selectionEnd: start + color.length + 2 + inner.length,
  }
}

/* --------------------------------------------------------- Liens wiki --- */

const WIKI_RE = /\[\[([^[\]]+)\]\]/g

/** Titres cités en `[[...]]` dans une page, dédoublonnés. */
export function wikiLinksIn(page: DocPage): string[] {
  const found = new Set<string>()
  for (const block of page.blocks) {
    if (block.type === 'code') continue
    WIKI_RE.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = WIKI_RE.exec(block.text)) !== null) found.add(match[1].trim())
  }
  return [...found]
}

export function normalizeTitle(title: string): string {
  return title.trim().toLowerCase()
}

/* ------------------------------------------------------------ Sommaire --- */

export interface TocEntry {
  blockId: string
  level: 1 | 2 | 3
  text: string
}

const HEADING_LEVEL: Partial<Record<DocBlockType, 1 | 2 | 3>> = {
  heading1: 1,
  heading2: 2,
  heading3: 3,
}

export function buildToc(page: DocPage): TocEntry[] {
  const entries: TocEntry[] = []
  for (const block of page.blocks) {
    const level = HEADING_LEVEL[block.type]
    const text = blockPlainText(block).trim()
    if (level && text) entries.push({ blockId: block.id, level, text })
  }
  return entries
}

/* -------------------------------------------------------------- Export --- */

const COLOR_HEX = new Map(DOC_TEXT_COLORS.map((color) => [color.id as string, color.hex]))
const COLOR_RE = new RegExp(COLOR_SOURCE, 'g')

/**
 * Markdown n'a ni souligné ni couleur : on retombe sur le HTML, qu'il accepte.
 * La couleur part en dur, avec la teinte du thème par défaut — un fichier
 * exporté n'a plus de thème pour la lui donner.
 */
function markersToMarkdown(text: string): string {
  return text
    .replace(/\+\+(.+?)\+\+/g, '<u>$1</u>')
    .replace(COLOR_RE, (_full, id: string, inner: string) => `<span style="color: ${COLOR_HEX.get(id)}">${inner}</span>`)
}

function blockToMarkdown(block: DocBlock): string {
  const text = block.type === 'code' ? block.text : markersToMarkdown(block.text)
  switch (block.type) {
    case 'heading1':
      return `# ${text}`
    case 'heading2':
      return `## ${text}`
    case 'heading3':
      return `### ${text}`
    case 'code':
      return `\`\`\`${block.language ?? ''}\n${text}\n\`\`\``
    case 'bulleted':
      return text
        .split('\n')
        .map((line) => `- ${line}`)
        .join('\n')
    case 'numbered':
      return text
        .split('\n')
        .map((line, i) => `${i + 1}. ${line}`)
        .join('\n')
    case 'quote':
    case 'callout':
      return text
        .split('\n')
        .map((line) => `> ${line}`)
        .join('\n')
    case 'divider':
      return '---'
    default:
      return text
  }
}

export function pageToMarkdown(page: DocPage, titleLevel = 1): string {
  const heading = `${'#'.repeat(Math.min(titleLevel, 6))} ${page.icon ? `${page.icon} ` : ''}${page.title}`
  const body = page.blocks.map(blockToMarkdown).join('\n\n')
  return body ? `${heading}\n\n${body}\n` : `${heading}\n`
}

/** Toute une branche (page + descendants), les sous-pages en titres plus profonds. */
export function treeToMarkdown(nodes: DocPageNode[], titleLevel = 1): string {
  return nodes
    .map((node) => {
      const own = pageToMarkdown(node, titleLevel)
      const children = node.children.length ? `\n${treeToMarkdown(node.children, titleLevel + 1)}` : ''
      return `${own}${children}`
    })
    .join('\n')
}

/** `Deploy Railway` → `deploy-railway.md` */
export function docFileName(title: string): string {
  const slug =
    foldText(title)
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'page'
  return `${slug}.md`
}

/* ----------------------------------------------------------- Recherche --- */

export interface DocSearchHit {
  page: DocPage
  /** Passage autour de la première correspondance, ou début de page. */
  excerpt: string
  matchedTitle: boolean
}

export function searchExcerpt(text: string, query: string, radius = 45): string {
  // Une page est multi-blocs : l'extrait tient sur une ligne, sans les sauts.
  const flat = text.replace(/\s+/g, ' ').trim()
  const idx = flat.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return flat.slice(0, radius * 2).trim()
  const start = Math.max(0, idx - radius)
  const end = Math.min(flat.length, idx + query.length + radius)
  return `${start > 0 ? '…' : ''}${flat.slice(start, end).trim()}${end < flat.length ? '…' : ''}`
}
