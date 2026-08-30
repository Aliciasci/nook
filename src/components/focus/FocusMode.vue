<script setup lang="ts">
import { computed } from 'vue'
import { useFocusSession } from '@/composables/useFocusSession'
import { useTheme } from '@/composables/useTheme'
import type { PresetThemeId } from '@/composables/useTheme'
import FocusSetup from '@/components/focus/FocusSetup.vue'
import FocusRunning from '@/components/focus/FocusRunning.vue'
import FocusComplete from '@/components/focus/FocusComplete.vue'

const { state } = useFocusSession()
const theme = useTheme()

const activeThemeId = computed(() =>
  theme.state.themeId === 'custom' ? theme.state.customTheme.baseTheme : theme.state.themeId,
)
const showDecoration = computed(() => theme.state.visualIntensity !== 'minimal')
const DECORATION_ANIM: Partial<Record<PresetThemeId, string>> = {
  gothic: 'theme-anim-moon',
  'soft-pink': 'theme-anim-twinkle',
  garden: 'theme-anim-sway',
}
const decorationAnim = computed(() =>
  theme.state.animationsEnabled && theme.state.visualIntensity !== 'minimal'
    ? (DECORATION_ANIM[activeThemeId.value] ?? '')
    : '',
)
</script>

<template>
  <Teleport to="body">
    <Transition name="fade-slide">
      <div
        v-if="state.isActive"
        class="fixed inset-0 z-[100] overflow-hidden bg-gradient-to-b from-lavender-50 via-paper to-paper"
      >
        <!-- Extremely subtle, theme-flavored corner decoration — never near the
             center of attention, and hidden entirely at Minimal intensity. -->
        <template v-if="showDecoration">
          <div
            v-if="activeThemeId === 'gothic'"
            class="pointer-events-none absolute right-10 top-10 h-24 w-24 rounded-full bg-lavender-300/25 blur-md"
            :class="decorationAnim"
          />
          <span
            v-else-if="activeThemeId === 'soft-pink'"
            class="pointer-events-none absolute right-14 top-14 text-3xl opacity-30"
            :class="decorationAnim"
          >
            ✨
          </span>
          <span
            v-else-if="activeThemeId === 'garden'"
            class="pointer-events-none absolute right-14 top-14 text-3xl opacity-25"
            :class="decorationAnim"
          >
            🌿
          </span>
        </template>

        <Transition name="fade-slide" mode="out-in">
          <FocusSetup v-if="state.phase === 'setup'" key="setup" />
          <FocusRunning v-else-if="state.phase === 'running' || state.phase === 'paused'" key="running" />
          <FocusComplete v-else key="complete" />
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>
