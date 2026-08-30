<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import type { TimeBlock } from '@/types'
import {
  useTimeBlocks,
  addDays,
  addMonths,
  endOfMonth,
  monthGridDays,
  parseDayIso,
  startOfMonth,
  startOfWeek,
  todayIso,
  weekDays,
} from '@/store/useTimeBlocks'
import { useFocusSession } from '@/composables/useFocusSession'
import PageHeader from '@/components/common/PageHeader.vue'
import QuickAddButton from '@/components/common/QuickAddButton.vue'
import TimeGrid from '@/components/planning/TimeGrid.vue'
import MonthGrid from '@/components/planning/MonthGrid.vue'
import UnscheduledPanel from '@/components/planning/UnscheduledPanel.vue'
import PeriodSummary from '@/components/planning/PeriodSummary.vue'
import DistributionCard from '@/components/planning/DistributionCard.vue'
import DailyTipCard from '@/components/planning/DailyTipCard.vue'
import ActivitySuggestions from '@/components/planning/ActivitySuggestions.vue'
import TipBanner from '@/components/planning/TipBanner.vue'
import IconChevronLeft from '@/icons/IconChevronLeft.vue'
import IconSprout from '@/icons/IconSprout.vue'

type ViewMode = 'jour' | 'semaine' | 'mois'

const VIEW_STORAGE_KEY = 'nook:planning-view'
const MODES: { id: ViewMode; label: string }[] = [
  { id: 'jour', label: 'Jour' },
  { id: 'semaine', label: 'Semaine' },
  { id: 'mois', label: 'Mois' },
]

const route = useRoute()
const blocks = useTimeBlocks()
const focus = useFocusSession()

// Le jour peut être fixé par l'URL (`/planning?jour=2026-08-28`), ce qui rend
// une journée précise partageable et remarquable. Aucun lien de l'app ne s'en
// sert pour l'instant : les flèches changent le jour sans toucher à l'URL.
// Sans paramètre, on ouvre sur aujourd'hui.
const initialDay =
  typeof route.query.jour === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(route.query.jour) ? route.query.jour : todayIso()

/**
 * La vue : l'URL d'abord (`?vue=semaine`), sinon celle de la dernière visite.
 * Elle est retenue par navigateur, comme le repli des panneaux de la
 * documentation — c'est une habitude de lecture, pas une donnée du nook.
 */
function initialView(): ViewMode {
  const fromQuery = route.query.vue
  if (typeof fromQuery === 'string' && MODES.some((m) => m.id === fromQuery)) return fromQuery as ViewMode
  try {
    const stored = localStorage.getItem(VIEW_STORAGE_KEY)
    if (stored && MODES.some((m) => m.id === stored)) return stored as ViewMode
  } catch {
    // Navigation privée, stockage refusé : la vue jour fera l'affaire.
  }
  return 'jour'
}

const day = ref(initialDay)
const view = ref<ViewMode>(initialView())

watch(view, (mode) => {
  try {
    localStorage.setItem(VIEW_STORAGE_KEY, mode)
  } catch {
    // Sans stockage, la vue vaut pour la visite en cours. Rien de perdu.
  }
})

// L'heure courante est descendue dans les grilles plutôt que relevée par
// elles : sept colonnes ou quarante-deux cases, un seul battement de minuterie.
const now = ref(new Date())
let timer: number | undefined
onMounted(() => {
  timer = window.setInterval(() => (now.value = new Date()), 30_000)
})
onBeforeUnmount(() => {
  if (timer) window.clearInterval(timer)
})

/* ------------------------------------------------------- La période --- */

const isToday = computed(() => day.value === todayIso())

/** Les jours affichés par la grille de la vue courante. */
const days = computed(() => {
  if (view.value === 'semaine') return weekDays(day.value)
  if (view.value === 'mois') return monthGridDays(day.value)
  return [day.value]
})

/**
 * Les bornes à charger. Jamais moins que la semaine, même en vue jour : c'est
 * ce qui permet aux flèches de changer de jour sans relancer une requête. En
 * vue mois, les 42 cases, jours voisins compris.
 */
const loadFrom = computed(() => (view.value === 'jour' ? startOfWeek(day.value) : days.value[0]))
const loadTo = computed(() =>
  view.value === 'jour' ? addDays(startOfWeek(day.value), 6) : days.value[days.value.length - 1],
)

/**
 * Les bornes du bilan. Elles ne suivent ni le chargement ni tout à fait
 * l'affichage : en vue mois, la grille montre la fin d'août et le début
 * d'octobre, mais « Bilan de septembre » ne compterait pas juste s'il les
 * additionnait.
 */
const summaryFrom = computed(() => (view.value === 'mois' ? startOfMonth(day.value) : days.value[0]))
const summaryTo = computed(() =>
  view.value === 'mois' ? endOfMonth(day.value) : days.value[days.value.length - 1],
)

watch([loadFrom, loadTo], ([from, to]) => void blocks.ensureRange(from, to), { immediate: true })

// Le nook peut changer sous la vue : le store se vide, il faut recharger.
watch(
  () => blocks.loaded.value,
  (loaded) => {
    if (!loaded) void blocks.ensureRange(loadFrom.value, loadTo.value)
  },
)

// Une session de focus qui se termine change le réalisé affiché sur les
// créneaux. Le nombre de sessions du jour est le signal le plus simple.
watch(
  () => focus.todayFocusStats.value.sessionCount,
  () => void blocks.refresh(),
)

/* ---------------------------------------------------------- Libellés --- */

const dateLabel = computed(() =>
  parseDayIso(day.value).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }),
)

const monthLabel = computed(() => parseDayIso(day.value).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }))

/** « du 5 au 11 septembre », « du 29 septembre au 5 octobre ». */
const weekLabel = computed(() => {
  const first = parseDayIso(days.value[0])
  const last = parseDayIso(days.value[6])
  const sameMonth = first.getMonth() === last.getMonth()
  const start = first.toLocaleDateString('fr-FR', sameMonth ? { day: 'numeric' } : { day: 'numeric', month: 'long' })
  const end = last.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
  return `du ${start} au ${end}`
})

/**
 * En vue jour, la date *est* le titre — « Jeudi 27 août ». Le bandeau dit
 * déjà si c'est aujourd'hui (le bouton « Aujourd'hui » s'y éteint), et une
 * page qui titre « Planning d'aujourd'hui » perd sa date au passage.
 */
const heading = computed(() => {
  if (view.value === 'semaine') {
    return startOfWeek(todayIso()) === days.value[0] ? 'Cette semaine' : `Semaine ${weekLabel.value}`
  }
  if (view.value === 'mois') return monthLabel.value.charAt(0).toUpperCase() + monthLabel.value.slice(1)
  return dateLabel.value.charAt(0).toUpperCase() + dateLabel.value.slice(1)
})

/**
 * Le sous-titre nomme la page, il ne la compte pas : le décompte des créneaux
 * et des heures posées est dans le bilan, à droite, et le répéter en haut
 * mettrait le même chiffre deux fois à l'écran.
 */
const subtitle = computed(() => {
  if (view.value === 'semaine') return 'Ta semaine, jour par jour.'
  if (view.value === 'mois') return "Ton mois d'un coup d'œil."
  if (isToday.value) return 'Ton planning du jour.'
  if (day.value === addDays(todayIso(), 1)) return 'Ton planning de demain.'
  return 'Ton planning de cette journée.'
})

/** « de septembre », mais « d'août » — avril, août et octobre s'élident. */
function ofMonth(month: string): string {
  return /^[aeiouâéèêîôû]/i.test(month) ? `d'${month}` : `de ${month}`
}

const summaryTitle = computed(() => {
  if (view.value === 'semaine') return 'Bilan de la semaine'
  if (view.value === 'mois') {
    return `Bilan ${ofMonth(parseDayIso(day.value).toLocaleDateString('fr-FR', { month: 'long' }))}`
  }
  return 'Bilan du jour'
})

const helpText = computed(() => {
  if (view.value === 'mois') {
    return "Clique un jour pour l'ouvrir en vue jour. Glisse une tâche depuis « À caser » — ou une activité depuis la rangée du haut — sur une case pour la poser à la suite de la journée."
  }
  const base =
    "Clique une activité pour la poser au prochain trou, ou glisse-la à l'heure exacte. Trace un créneau à la souris pour bloquer autre chose, glisse une tâche depuis « À caser » pour lui donner une heure. Le bord bas d'un créneau l'étire, et son menu ⋯ change sa catégorie ou démarre un focus."
  return view.value === 'semaine'
    ? `${base} Un créneau attrapé se déplace aussi d'un jour à l'autre.`
    : base
})

/* -------------------------------------------------------- Navigation --- */

/** « Aujourd'hui » ouvre la période qui contient aujourd'hui, pas le jour. */
const atPresent = computed(() => {
  if (view.value === 'semaine') return days.value.includes(todayIso())
  if (view.value === 'mois') return startOfMonth(day.value) === startOfMonth(todayIso())
  return isToday.value
})

const presentLabel = computed(() =>
  view.value === 'semaine' ? 'Cette semaine' : view.value === 'mois' ? 'Ce mois-ci' : "Aujourd'hui",
)

function step(delta: number) {
  if (view.value === 'semaine') day.value = addDays(day.value, delta * 7)
  else if (view.value === 'mois') day.value = addMonths(day.value, delta)
  else day.value = addDays(day.value, delta)
}

const stepLabel = computed(() =>
  view.value === 'semaine' ? 'semaine' : view.value === 'mois' ? 'mois' : 'jour',
)

/** Ouvrir un jour depuis la semaine ou le mois — l'usage même de ces vues. */
function pickDay(picked: string) {
  day.value = picked
  view.value = 'jour'
}

function onFocusBlock(block: TimeBlock) {
  const item = blocks.itemOf(block)
  if (!item) return
  focus.openFocus(item, blocks.plannedMinutes(block))
}
</script>

<template>
  <div class="page-sheet mx-auto px-8 py-9" :class="view === 'jour' ? 'max-w-[1200px]' : 'max-w-[1600px]'">
    <PageHeader :title="heading" :subtitle="subtitle">
      <template #badge>
        <IconSprout class="h-[19px] w-[19px] text-folder-green-ink" />
      </template>

      <!-- Sélecteur de vue -->
      <div class="flex items-center gap-0.5 rounded-full bg-white p-1 shadow-soft ring-1 ring-ink/[0.08]">
        <button
          v-for="m in MODES"
          :key="m.id"
          type="button"
          class="rounded-full px-3.5 py-1.5 text-[12.5px] font-medium transition-colors cursor-pointer"
          :class="
            view === m.id ? 'bg-lavender-500 text-white' : 'text-ink-faint hover:bg-lavender-50 hover:text-ink'
          "
          @click="view = m.id"
        >
          {{ m.label }}
        </button>
      </div>

      <div class="flex items-center gap-1 rounded-full bg-white p-1 shadow-soft ring-1 ring-ink/[0.08]">
        <button
          type="button"
          :title="`${stepLabel} précédent`"
          :aria-label="`${stepLabel} précédent`"
          class="rounded-full p-2 text-ink-faint transition-colors hover:bg-lavender-50 hover:text-ink cursor-pointer"
          @click="step(-1)"
        >
          <IconChevronLeft class="h-4 w-4" />
        </button>
        <button
          type="button"
          :disabled="atPresent"
          class="rounded-full px-3 py-1.5 text-[12.5px] font-medium transition-colors disabled:opacity-40 enabled:hover:bg-lavender-50 enabled:cursor-pointer"
          :class="atPresent ? 'text-ink-faint' : 'text-lavender-600'"
          @click="day = todayIso()"
        >
          {{ presentLabel }}
        </button>
        <button
          type="button"
          :title="`${stepLabel} suivant`"
          :aria-label="`${stepLabel} suivant`"
          class="rotate-180 rounded-full p-2 text-ink-faint transition-colors hover:bg-lavender-50 hover:text-ink cursor-pointer"
          @click="step(1)"
        >
          <IconChevronLeft class="h-4 w-4" />
        </button>
      </div>
      <QuickAddButton />
    </PageHeader>

    <div class="mt-7 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
      <div class="flex min-w-0 flex-col gap-4">
        <ActivitySuggestions :day="day" />

        <div class="min-w-0">
          <MonthGrid v-if="view === 'mois'" :days="days" :month="day" :now="now" @pick-day="pickDay" />
          <TimeGrid v-else :days="days" :now="now" @focus="onFocusBlock" @pick-day="pickDay" />
        </div>

        <TipBanner :text="helpText" />
      </div>

      <aside class="flex flex-col gap-5 lg:sticky lg:top-9 lg:self-start">
        <UnscheduledPanel :day="day" />
        <PeriodSummary :from="summaryFrom" :to="summaryTo" :title="summaryTitle" />
        <DistributionCard :from="summaryFrom" :to="summaryTo" />
        <DailyTipCard :day="day" />
      </aside>
    </div>
  </div>
</template>
