<script setup lang="ts">
import { onBeforeUnmount, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import Sidebar from '@/components/layout/Sidebar.vue'
import AppSkeleton from '@/components/common/AppSkeleton.vue'
import QuickCreateModal from '@/components/common/QuickCreateModal.vue'
import ItemDetailPanel from '@/components/common/ItemDetailPanel.vue'
import SearchModal from '@/components/common/SearchModal.vue'
import FolderEditModal from '@/components/common/FolderEditModal.vue'
import SelectionBar from '@/components/common/SelectionBar.vue'
import ThemePickerModal from '@/components/theme/ThemePickerModal.vue'
import DayProgressPanel from '@/components/dayprogress/DayProgressPanel.vue'
import SpotifyWidget from '@/components/spotify/SpotifyWidget.vue'
import FocusMode from '@/components/focus/FocusMode.vue'
import IconClock from '@/icons/IconClock.vue'
import { useUiState } from '@/composables/useUiState'
import { useDayPanel } from '@/composables/useDayPanel'
import { useFocusSession } from '@/composables/useFocusSession'
import { useSpotify } from '@/composables/useSpotify'
import { useGarden } from '@/composables/useGarden'
import { clearAllSelections } from '@/composables/useSelection'
import { useStore } from '@/store/useStore'

const { openSearch } = useUiState()
const dayPanel = useDayPanel()
const focus = useFocusSession()
const spotify = useSpotify()
const garden = useGarden()
const store = useStore()
const route = useRoute()

let dayBonusTimer: number | undefined

watch(
  () => route.fullPath,
  () => clearAllSelections(),
)

function onKeydown(e: KeyboardEvent) {
  if (focus.state.isActive) return
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    openSearch()
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  spotify.init()
  garden.checkDayCompleteBonus()
  dayBonusTimer = window.setInterval(() => garden.checkDayCompleteBonus(), 60_000)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  if (dayBonusTimer) window.clearInterval(dayBonusTimer)
})
</script>

<template>
  <div class="app-shell flex h-screen bg-paper">
    <Sidebar />
    <main class="min-w-0 flex-1 overflow-y-auto">
      <AppSkeleton v-if="store.isLoading.value && !store.loaded.value" />
      <RouterView v-else v-slot="{ Component, route }">
        <Transition name="fade-slide" mode="out-in">
          <component :is="Component" :key="route.meta.viewKey ?? route.fullPath" />
        </Transition>
      </RouterView>
    </main>

    <aside
      v-if="dayPanel.state.isOpen"
      class="hidden w-72 shrink-0 flex-col gap-5 overflow-y-auto border-l border-line bg-surface/70 px-4 py-5 xl:flex"
    >
      <DayProgressPanel @close="dayPanel.close" />
      <SpotifyWidget />
    </aside>
    <button
      v-else
      type="button"
      title="Afficher « Ma journée »"
      class="fixed right-0 top-24 z-10 hidden items-center gap-1.5 rounded-l-xl border border-r-0 border-line bg-white px-2.5 py-3 text-ink-faint shadow-soft transition-colors hover:bg-lavender-50 hover:text-lavender-600 xl:flex cursor-pointer"
      @click="dayPanel.open"
    >
      <IconClock class="h-4 w-4" />
    </button>

    <ItemDetailPanel />
    <QuickCreateModal />
    <SearchModal />
    <FolderEditModal />
    <FocusMode />
    <SelectionBar />
    <ThemePickerModal />
  </div>
</template>
