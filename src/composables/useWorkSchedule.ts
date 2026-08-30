import { watch } from 'vue'
import { prefsState, savePreferences } from '@/composables/usePreferencesStore'

export interface WorkSchedule {
  startTime: string
  lunchStart: string
  lunchEnd: string
  endTime: string
}

const schedule = prefsState.schedule

watch(schedule, savePreferences, { deep: true })

export function useWorkSchedule() {
  return { schedule }
}
