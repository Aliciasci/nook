import type { Folder, Item, Priority } from '@/types'

export type ReportStatusFilter = 'all' | 'done' | 'open'

export interface ReportFilters {
  /** Bornes incluses, au format `yyyy-mm-dd`. */
  from: string
  to: string
  status: ReportStatusFilter
  /** `null` = tous les dossiers. `'inbox'` = sans dossier. */
  folderId: string | null | 'inbox'
}

export interface ReportRow {
  item: Item
  folderName: string
  /** Jour retenu pour placer la tâche dans la période. */
  day: string
}

export interface ReportData {
  from: string
  to: string
  rows: ReportRow[]
  done: ReportRow[]
  open: ReportRow[]
  /** Tâches terminées regroupées par jour de complétion, du plus ancien au plus récent. */
  doneByDay: { day: string; rows: ReportRow[] }[]
  /** Tâches non terminées regroupées par dossier. */
  openByFolder: { folderName: string; rows: ReportRow[] }[]
  totals: { all: number; done: number; open: number; overdue: number; rate: number }
}

const PRIORITY_LABEL: Record<Priority, string> = {
  high: 'Haute',
  medium: 'Moyenne',
  low: 'Basse',
}

/** Jour local (et non UTC) d'un timestamp ISO — sinon une tâche cochée le soir bascule au lendemain. */
export function toLocalDay(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
}

export function todayISO(): string {
  return toLocalDay(new Date().toISOString())
}

/**
 * Date qui rattache une tâche à la période : le jour où elle a été terminée pour
 * une tâche cochée, sinon son échéance et, à défaut, sa date de création.
 */
export function referenceDay(item: Item): string {
  if (item.status === 'done') return toLocalDay(item.updatedAt)
  return item.dueDate ?? toLocalDay(item.createdAt)
}

export function priorityLabel(p: Priority | null | undefined): string {
  return p ? PRIORITY_LABEL[p] : '—'
}

export function statusLabel(item: Item): string {
  if (item.status === 'done') return 'Terminée'
  if (item.status === 'in_progress') return 'En cours'
  return 'À faire'
}

export function formatDay(day: string, opts: Intl.DateTimeFormatOptions = {}): string {
  const d = new Date(day + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return day
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', ...opts })
}

export function buildReport(items: Item[], folders: Folder[], filters: ReportFilters): ReportData {
  const from = filters.from <= filters.to ? filters.from : filters.to
  const to = filters.from <= filters.to ? filters.to : filters.from
  const folderNames = new Map(folders.map((f) => [f.id, f.name]))
  const today = todayISO()

  const rows: ReportRow[] = []
  for (const item of items) {
    if (item.type !== 'task') continue
    if (filters.status === 'done' && item.status !== 'done') continue
    if (filters.status === 'open' && item.status === 'done') continue
    if (filters.folderId === 'inbox' && item.folderId !== null) continue
    if (filters.folderId !== null && filters.folderId !== 'inbox' && item.folderId !== filters.folderId) continue

    const day = referenceDay(item)
    if (day < from || day > to) continue

    rows.push({
      item,
      folderName: item.folderId ? (folderNames.get(item.folderId) ?? 'Dossier supprimé') : 'Inbox',
      day,
    })
  }

  rows.sort((a, b) => a.day.localeCompare(b.day) || a.item.title.localeCompare(b.item.title, 'fr'))

  const done = rows.filter((r) => r.item.status === 'done')
  const open = rows.filter((r) => r.item.status !== 'done')

  const dayBuckets = new Map<string, ReportRow[]>()
  for (const row of done) {
    const bucket = dayBuckets.get(row.day)
    if (bucket) bucket.push(row)
    else dayBuckets.set(row.day, [row])
  }
  const doneByDay = [...dayBuckets.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([day, dayRows]) => ({ day, rows: dayRows }))

  const folderBuckets = new Map<string, ReportRow[]>()
  for (const row of open) {
    const bucket = folderBuckets.get(row.folderName)
    if (bucket) bucket.push(row)
    else folderBuckets.set(row.folderName, [row])
  }
  const openByFolder = [...folderBuckets.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], 'fr'))
    .map(([folderName, folderRows]) => ({ folderName, rows: folderRows }))

  const overdue = open.filter((r) => r.item.dueDate && r.item.dueDate < today).length

  return {
    from,
    to,
    rows,
    done,
    open,
    doneByDay,
    openByFolder,
    totals: {
      all: rows.length,
      done: done.length,
      open: open.length,
      overdue,
      rate: rows.length ? Math.round((done.length / rows.length) * 100) : 0,
    },
  }
}

export function reportFileName(report: ReportData, extension: string): string {
  return `nook-rapport-${report.from}_${report.to}.${extension}`
}

/* ------------------------------------------------------------------ CSV --- */

function csvCell(value: string): string {
  return /[";\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

export function buildReportCsv(report: ReportData): string {
  const header = ['Date', 'Statut', 'Tâche', 'Dossier', 'Priorité', 'Échéance', 'Créée le', 'Mise à jour le']
  const lines = [header.join(';')]
  for (const { item, folderName, day } of report.rows) {
    lines.push(
      [
        day,
        statusLabel(item),
        item.title,
        folderName,
        priorityLabel(item.priority),
        item.dueDate ?? '',
        toLocalDay(item.createdAt),
        toLocalDay(item.updatedAt),
      ]
        .map(csvCell)
        .join(';'),
    )
  }
  // BOM : sans lui Excel lit le fichier en latin-1 et casse les accents.
  return '﻿' + lines.join('\r\n')
}

export function downloadFile(content: string, fileName: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

/* ------------------------------------------------------------------ PDF --- */

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function rowCells(row: ReportRow, today: string): string {
  const { item } = row
  const late = item.status !== 'done' && item.dueDate && item.dueDate < today
  const due = item.dueDate ? formatDay(item.dueDate, { year: undefined, month: 'short' }) : '—'
  return `
    <td class="title">${esc(item.title)}</td>
    <td class="muted">${esc(row.folderName)}</td>
    <td class="muted">${esc(priorityLabel(item.priority))}</td>
    <td class="muted${late ? ' late' : ''}">${esc(due)}${late ? ' ⚠' : ''}</td>`
}

export function buildReportHtml(report: ReportData, filterLabel: string): string {
  const today = todayISO()
  const title = `Rapport Nook — ${formatDay(report.from)} au ${formatDay(report.to)}`

  const doneSection = report.doneByDay.length
    ? report.doneByDay
        .map(
          (group) => `
      <h3>${esc(formatDay(group.day, { weekday: 'long' }))} <span class="count">${group.rows.length}</span></h3>
      <table>
        <tbody>
          ${group.rows.map((row) => `<tr><td class="mark">✓</td>${rowCells(row, today)}</tr>`).join('')}
        </tbody>
      </table>`,
        )
        .join('')
    : '<p class="empty">Aucune tâche terminée sur cette période.</p>'

  const openSection = report.openByFolder.length
    ? report.openByFolder
        .map(
          (group) => `
      <h3>${esc(group.folderName)} <span class="count">${group.rows.length}</span></h3>
      <table>
        <tbody>
          ${group.rows.map((row) => `<tr><td class="mark todo">○</td>${rowCells(row, today)}</tr>`).join('')}
        </tbody>
      </table>`,
        )
        .join('')
    : '<p class="empty">Aucune tâche en attente sur cette période.</p>'

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<title>${esc(title)}</title>
<style>
  @page { size: A4; margin: 16mm 14mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif;
    color: #2b2733;
    font-size: 11px;
    line-height: 1.5;
  }
  header { border-bottom: 1px solid #ece7f0; padding-bottom: 14px; margin-bottom: 18px; }
  h1 { font-family: "Fraunces", ui-serif, Georgia, serif; font-size: 22px; font-weight: 500; margin: 0; }
  .period { color: #635d6c; font-size: 12px; margin-top: 4px; }
  .filters { color: #9691a0; font-size: 10.5px; margin-top: 2px; }
  .stats { display: flex; gap: 10px; margin-bottom: 22px; }
  .stat { flex: 1; border: 1px solid #ece7f0; border-radius: 10px; padding: 9px 11px; }
  .stat .value { font-family: "Fraunces", ui-serif, Georgia, serif; font-size: 19px; }
  .stat .label { color: #9691a0; font-size: 10px; text-transform: uppercase; letter-spacing: .04em; }
  h2 {
    font-family: "Fraunces", ui-serif, Georgia, serif;
    font-size: 14px; font-weight: 500; margin: 22px 0 8px;
    padding-bottom: 5px; border-bottom: 1px solid #ece7f0;
  }
  h3 { font-size: 11px; font-weight: 600; margin: 12px 0 4px; color: #635d6c; }
  h3 .count { color: #9691a0; font-weight: 500; }
  table { width: 100%; border-collapse: collapse; }
  tr { page-break-inside: avoid; }
  td { padding: 3.5px 6px; border-bottom: 1px solid #f4f1f7; vertical-align: top; }
  td.mark { width: 14px; color: #7550d6; }
  td.mark.todo { color: #c9c3d1; }
  td.title { width: 55%; }
  td.muted { color: #635d6c; white-space: nowrap; }
  td.late { color: #b4483f; }
  .empty { color: #9691a0; font-style: italic; }
  footer { margin-top: 26px; color: #9691a0; font-size: 9.5px; text-align: center; }
</style>
</head>
<body>
  <header>
    <h1>Rapport d'activité</h1>
    <p class="period">Du ${esc(formatDay(report.from))} au ${esc(formatDay(report.to))}</p>
    <p class="filters">${esc(filterLabel)}</p>
  </header>

  <section class="stats">
    <div class="stat"><div class="value">${report.totals.all}</div><div class="label">Tâches</div></div>
    <div class="stat"><div class="value">${report.totals.done}</div><div class="label">Terminées</div></div>
    <div class="stat"><div class="value">${report.totals.open}</div><div class="label">En attente</div></div>
    <div class="stat"><div class="value">${report.totals.rate}%</div><div class="label">Complétion</div></div>
  </section>

  <h2>Tâches terminées</h2>
  ${doneSection}

  <h2>Tâches non terminées</h2>
  ${openSection}

  <footer>Généré depuis Nook le ${esc(formatDay(today))}</footer>
</body>
</html>`
}

/**
 * Imprime le rapport via une iframe cachée : contrairement à `window.open`, ça ne
 * déclenche pas les bloqueurs de pop-up. « Enregistrer au format PDF » dans la
 * boîte d'impression produit le fichier.
 */
export function printHtml(html: string) {
  const frame = document.createElement('iframe')
  frame.setAttribute('aria-hidden', 'true')
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden'
  frame.srcdoc = html
  frame.onload = () => {
    const win = frame.contentWindow
    if (!win) {
      frame.remove()
      return
    }
    win.focus()
    win.print()
    // L'impression est synchrone dans les navigateurs de bureau, mais on laisse
    // une marge avant de retirer l'iframe pour ne pas annuler le rendu.
    window.setTimeout(() => frame.remove(), 1000)
  }
  document.body.appendChild(frame)
}
