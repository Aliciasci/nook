import { describe, expect, it } from 'vitest'
import { applyTextColor, formatInline, insertLink, toggleMark } from './docs'

describe('formatInline', () => {
  it('renders bold, italic and combined bold-italic', () => {
    expect(formatInline('**gras**').html).toBe('<strong>gras</strong>')
    expect(formatInline('*italique*').html).toBe('<em>italique</em>')
    expect(formatInline('***gras italique***').html).toBe('<strong><em>gras italique</em></strong>')
  })

  it('renders underline, strike and inline code', () => {
    expect(formatInline('++souligné++').html).toBe('<u>souligné</u>')
    expect(formatInline('~~barré~~').html).toBe('<s>barré</s>')
    expect(formatInline('`code`').html).toContain('<code class="doc-code-inline">code</code>')
  })

  it('does not format markers inside inline code', () => {
    expect(formatInline('`**pas gras**`').html).toContain('doc-code-inline">**pas gras**<')
  })

  it('combines nested styles', () => {
    expect(formatInline('++souligné **et gras**++').html).toBe('<u>souligné <strong>et gras</strong></u>')
  })

  it('renders wiki links only when enabled', () => {
    expect(formatInline('[[Titre]]', { wikiLinks: true }).html).toContain('data-wiki="Titre"')
    expect(formatInline('[[Titre]]', { wikiLinks: false }).html).toBe('[[Titre]]')
  })

  it('renders a safe link but refuses a javascript: scheme', () => {
    expect(formatInline('[texte](https://example.com)').html).toContain('href="https://example.com"')
    expect(formatInline('[texte](javascript:alert(1))').html).toBe('[texte](javascript:alert(1))')
  })

  it('escapes raw HTML in plain text', () => {
    expect(formatInline('<script>').html).toBe('&lt;script&gt;')
  })

  it('renders a text color span', () => {
    expect(formatInline('{blue|texte}').html).toBe('<span class="doc-color-blue">texte</span>')
  })

  it('keeps a plain/map correspondence to the raw source', () => {
    const { plain, map } = formatInline('**gras**')
    expect(plain).toBe('gras')
    // map[i] is the raw-source index of the i-th rendered character.
    expect(map).toEqual([2, 3, 4, 5, 8])
  })
})

describe('toggleMark', () => {
  it('wraps a plain selection', () => {
    const result = toggleMark('hello world', 0, 5, 'bold')
    expect(result.text).toBe('**hello** world')
    expect([result.selectionStart, result.selectionEnd]).toEqual([2, 7])
  })

  it('unwraps when the marker is inside the selection', () => {
    const result = toggleMark('**hello** world', 0, 9, 'bold')
    expect(result.text).toBe('hello world')
  })

  it('unwraps when the marker surrounds the selection', () => {
    const result = toggleMark('**hello** world', 2, 7, 'bold')
    expect(result.text).toBe('hello world')
  })

  it('treats italic parity independently of bold', () => {
    // Selecting the inner text of a bold+italic run should only toggle italic.
    const result = toggleMark('***hello***', 3, 8, 'italic')
    expect(result.text).toBe('**hello**')
  })
})

describe('insertLink', () => {
  it('wraps the selection and places the cursor inside the url placeholder', () => {
    const result = insertLink('see this page', 4, 8)
    expect(result.text).toBe('see [this](url) page')
    expect(result.text.slice(result.selectionStart, result.selectionEnd)).toBe('url')
  })

  it('uses a placeholder label for an empty selection', () => {
    const result = insertLink('', 0, 0)
    expect(result.text).toBe('[texte](url)')
  })
})

describe('applyTextColor', () => {
  it('wraps a plain selection in a color marker', () => {
    const result = applyTextColor('hello world', 0, 5, 'blue')
    expect(result.text).toBe('{blue|hello} world')
  })

  it('removes the marker when the same color is re-applied on the wrapped selection', () => {
    const result = applyTextColor('{blue|hello} world', 0, 12, 'blue')
    expect(result.text).toBe('hello world')
  })

  it('recolors when a different color is applied around the selection', () => {
    const result = applyTextColor('{blue|hello} world', 6, 11, 'green')
    expect(result.text).toBe('{green|hello} world')
  })

  it('strips color entirely when color is null', () => {
    const result = applyTextColor('{blue|hello} world', 6, 11, null)
    expect(result.text).toBe('hello world')
  })
})
