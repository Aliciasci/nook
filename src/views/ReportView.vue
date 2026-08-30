<script setup lang="ts">
import { computed, reactive } from 'vue'
import { useStore } from '@/store/useStore'
import { useToast } from '@/composables/useToast'
import PageHeader from '@/components/common/PageHeader.vue'
import PlanningReportCard from '@/components/planning/PlanningReportCard.vue'
import {
  buildReport,
  buildReportCsv,
  buildReportHtml,
  downloadFile,
  formatDay,
  printHtml,
  priorityLabel,
  reportFileName,
  todayISO,
  type ReportStatusFilter,
} from '@/utils/report'

const { items, folders } = useStore()
const toast = useToast()

function shiftDays(day: string, delta: number): string {
  const d = new Date(day + 'T00:00:00')
  d.setDate(d.getDate() + delta)
  return d.toISOString().slice(0, 10)
}

function startOfMonth(offsetMonths: number): { from: string; to: string } {
  const now = new Date()
  const first = new Date(now.getFullYear(), now.getMonth() + offsetMonths, 1)
  const last = new Date(now.getFullYear(), now.getMonth() + offsetMonths + 1, 0)
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return { from: fmt(first), to: fmt(last) }
}

const filters = reactive({
  from: shiftDays(todayISO(), -29),
  to: todayISO(),
  status: 'all' as ReportStatusFilter,
  folderId: null as string | null | 'inbox',
})

const presets = [
  { label: '7 derniers jours', apply: () => ({ from: shiftDays(todayISO(), -6), to: todayISO() }) },
  { label: '30 derniers jours', apply: () => ({ from: shiftDays(todayISO(), -29), to: todayISO() }) },
  { label: 'Ce mois-ci', apply: () => startOfMonth(0) },
  { label: 'Mois dernier', apply: () => startOfMonth(-1) },
]

function applyPreset(preset: (typeof presets)[number]) {
  const range = preset.apply()
  filters.from = range.from
  filters.to = range.to
}

function isActivePreset(preset: (typeof presets)[number]) {
  const range = preset.apply()
  return filters.from === range.from && filters.to === range.to
}

const statusOptions: { value: ReportStatusFilter; label: string }[] = [
  { value: 'all', label: 'Toutes' },
  { value: 'done', label: 'Terminées' },
  { value: 'open', label: 'Non terminées' },
]

const report = computed(() => buildReport(items.value, folders.value, filters))

const folderLabel = computed(() => {
  if (filters.folderId === null) return 'Tous les dossiers'
  if (filters.folderId === 'inbox') return 'Inbox'
  return folders.value.find((f) => f.id === filters.folderId)?.name ?? 'Dossier inconnu'
})

const filterLabel = computed(() => {
  const status = statusOptions.find((o) => o.value === filters.status)?.label ?? 'Toutes'
  return `${folderLabel.value} · ${status.toLowerCase()}`
})

function exportPdf() {
  if (!report.value.rows.length) {
    toast.error('Aucune tâche sur cette période — rien à exporter.')
    return
  }
  printHtml(buildReportHtml(report.value, filterLabel.value))
}

function exportCsv() {
  if (!report.value.rows.length) {
    toast.error('Aucune tâche sur cette période — rien à exporter.')
    return
  }
  downloadFile(buildReportCsv(report.value), reportFileName(report.value, 'csv'), 'text/csv;charset=utf-8')
  toast.push('Export CSV téléchargé.')
}

const inputClass =
  'w-full rounded-xl border border-line bg-white px-3 py-2 text-[13px] text-ink outline-none transition-colors focus:border-lavender-300 cursor-pointer'
</script>

<template>
  <div class="page-sheet mx-auto max-w-3xl px-8 py-9">
    <PageHeader title="Rapport" subtitle="Exporte tes tâches, terminées ou non, sur la période de ton choix." />

    <section class="mt-7 rounded-2xl bg-white p-5 shadow-soft ring-1 ring-ink/[0.08]">
      <div class="flex flex-wrap gap-2">
        <button
          v-for="preset in presets"
          :key="preset.label"
          type="button"
          class="rounded-full px-3 py-1.5 text-[12.5px] font-medium transition-colors cursor-pointer"
          :class="
            isActivePreset(preset)
              ? 'bg-lavender-500 text-white'
              : 'bg-lavender-50 text-lavender-700 hover:bg-lavender-100'
          "
          @click="applyPreset(preset)"
        >
          {{ preset.label }}
        </button>
      </div>

      <div class="mt-4 grid gap-3 sm:grid-cols-2">
        <label class="block">
          <span class="text-[12px] font-medium text-ink-soft">Du</span>
          <input v-model="filters.from" type="date" :max="filters.to" :class="inputClass" class="mt-1" />
        </label>
        <label class="block">
          <span class="text-[12px] font-medium text-ink-soft">Au</span>
          <input v-model="filters.to" type="date" :min="filters.from" :class="inputClass" class="mt-1" />
        </label>
        <label class="block">
          <span class="text-[12px] font-medium text-ink-soft">Statut</span>
          <select v-model="filters.status" :class="inputClass" class="mt-1">
            <option v-for="opt in statusOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
        </label>
        <label class="block">
          <span class="text-[12px] font-medium text-ink-soft">Dossier</span>
          <select v-model="filters.folderId" :class="inputClass" class="mt-1">
            <option :value="null">Tous les dossiers</option>
            <option value="inbox">Inbox (sans dossier)</option>
            <option v-for="f in folders" :key="f.id" :value="f.id">{{ f.icon }} {{ f.name }}</option>
          </select>
        </label>
      </div>

      <p class="mt-3 text-[12px] text-ink-faint">
        Une tâche terminée compte le jour où elle a été cochée ; une tâche en attente compte à son échéance, ou à
        défaut à sa date de création.
      </p>

      <div class="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
        <button
          type="button"
          class="rounded-xl bg-lavender-500 px-3.5 py-2 text-[12.5px] font-medium text-white shadow-soft transition-colors hover:bg-lavender-600 cursor-pointer"
          @click="exportPdf"
        >
          Exporter en PDF
        </button>
        <button
          type="button"
          class="rounded-xl bg-lavender-50 px-3.5 py-2 text-[12.5px] font-medium text-lavender-700 transition-colors hover:bg-lavender-100 cursor-pointer"
          @click="exportCsv"
        >
          Exporter en CSV
        </button>
      </div>
      <p class="mt-2 text-[11.5px] text-ink-faint">
        L'export PDF ouvre la fenêtre d'impression : choisis « Enregistrer au format PDF » comme destination.
      </p>
    </section>

    <PlanningReportCard :from="filters.from" :to="filters.to" />

    <section class="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div
        v-for="stat in [
          { label: 'Tâches', value: report.totals.all },
          { label: 'Terminées', value: report.totals.done },
          { label: 'En attente', value: report.totals.open },
          { label: 'Complétion', value: `${report.totals.rate}%` },
        ]"
        :key="stat.label"
        class="rounded-2xl bg-white p-4 shadow-soft ring-1 ring-ink/[0.08]"
      >
        <p class="font-display text-[21px] font-medium text-ink">{{ stat.value }}</p>
        <p class="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">{{ stat.label }}</p>
      </div>
    </section>

    <div
      v-if="report.rows.length === 0"
      class="mt-5 rounded-2xl bg-white p-10 text-center shadow-soft ring-1 ring-ink/[0.08]"
    >
      <p class="text-[13.5px] text-ink-faint">Aucune tâche sur cette période.</p>
    </div>

    <template v-else>
      <section v-if="report.doneByDay.length" class="mt-6">
        <h2 class="font-display text-[16px] font-medium text-ink">Terminées</h2>
        <div v-for="group in report.doneByDay" :key="group.day" class="mt-3 rounded-2xl bg-white p-4 shadow-soft ring-1 ring-ink/[0.08]">
          <p class="text-[12px] font-semibold text-ink-soft">
            {{ formatDay(group.day, { weekday: 'long' }) }}
            <span class="font-medium text-ink-faint">· {{ group.rows.length }}</span>
          </p>
          <ul class="mt-2 space-y-1.5">
            <li v-for="row in group.rows" :key="row.item.id" class="flex items-baseline gap-2 text-[13px]">
              <span class="text-lavender-600">✓</span>
              <span class="text-ink">{{ row.item.title }}</span>
              <span class="ml-auto shrink-0 text-[11.5px] text-ink-faint">{{ row.folderName }}</span>
            </li>
          </ul>
        </div>
      </section>

      <section v-if="report.openByFolder.length" class="mt-6">
        <h2 class="font-display text-[16px] font-medium text-ink">Non terminées</h2>
        <div
          v-for="group in report.openByFolder"
          :key="group.folderName"
          class="mt-3 rounded-2xl bg-white p-4 shadow-soft ring-1 ring-ink/[0.08]"
        >
          <p class="text-[12px] font-semibold text-ink-soft">
            {{ group.folderName }}
            <span class="font-medium text-ink-faint">· {{ group.rows.length }}</span>
          </p>
          <ul class="mt-2 space-y-1.5">
            <li v-for="row in group.rows" :key="row.item.id" class="flex items-baseline gap-2 text-[13px]">
              <span class="text-ink-faint">○</span>
              <span class="text-ink">{{ row.item.title }}</span>
              <span class="ml-auto shrink-0 text-[11.5px] text-ink-faint">
                {{ priorityLabel(row.item.priority) }}
              </span>
            </li>
          </ul>
        </div>
      </section>
    </template>
  </div>
</template>
