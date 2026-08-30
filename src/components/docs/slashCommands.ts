import type { DocBlockType } from '@/types'

export interface SlashCommand {
  type: DocBlockType
  label: string
  hint: string
  /** Termes de recherche supplémentaires — le label est toujours inclus. */
  keywords: string[]
  glyph: string
}

export const SLASH_COMMANDS: SlashCommand[] = [
  { type: 'paragraph', label: 'Texte', hint: 'Paragraphe simple', keywords: ['paragraphe', 'text'], glyph: '¶' },
  { type: 'heading1', label: 'Titre 1', hint: 'Grand titre de section', keywords: ['h1', 'titre'], glyph: 'H1' },
  { type: 'heading2', label: 'Titre 2', hint: 'Sous-titre', keywords: ['h2', 'titre'], glyph: 'H2' },
  { type: 'heading3', label: 'Titre 3', hint: 'Titre de niveau 3', keywords: ['h3', 'titre'], glyph: 'H3' },
  { type: 'code', label: 'Code', hint: 'Bloc monospace, pour du code ou une commande', keywords: ['snippet', 'terminal', 'sql', 'bash'], glyph: '</>' },
  { type: 'bulleted', label: 'Liste à puces', hint: 'Énumération', keywords: ['puce', 'ul', 'liste'], glyph: '•' },
  { type: 'numbered', label: 'Liste numérotée', hint: 'Étapes ordonnées', keywords: ['ol', 'liste', 'etapes'], glyph: '1.' },
  { type: 'quote', label: 'Citation', hint: 'Passage mis en retrait', keywords: ['quote', 'citation'], glyph: '❝' },
  { type: 'callout', label: 'Encadré', hint: 'Note à mettre en avant', keywords: ['note', 'attention', 'info'], glyph: '💡' },
  { type: 'divider', label: 'Séparateur', hint: 'Trait horizontal', keywords: ['hr', 'ligne', 'separateur'], glyph: '—' },
]

/** Langages proposés sur un bloc de code. `text` = pas de langage particulier. */
export const CODE_LANGUAGES = [
  'text',
  'bash',
  'sql',
  'json',
  'yaml',
  'typescript',
  'javascript',
  'vue',
  'html',
  'css',
  'python',
  'php',
] as const
