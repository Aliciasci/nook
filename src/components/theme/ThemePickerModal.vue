<script setup lang="ts">
import { computed, ref } from 'vue'
import { useUiState } from '@/composables/useUiState'
import { useTheme } from '@/composables/useTheme'
import type { ThemeMode, VisualIntensity, CornerStyle } from '@/composables/useTheme'
import ThemePreviewCard from '@/components/theme/ThemePreviewCard.vue'
import IconX from '@/icons/IconX.vue'
import IconChevronLeft from '@/icons/IconChevronLeft.vue'

const { state: ui, closeThemePicker } = useUiState()
const theme = useTheme()

const view = ref<'gallery' | 'custom'>('gallery')

const modeOptions: { key: ThemeMode; label: string }[] = [
  { key: 'light', label: '☀️ Clair' },
  { key: 'dark', label: '🌑 Sombre' },
  { key: 'auto', label: '🌗 Automatique' },
]

const intensityOptions: { key: VisualIntensity; label: string }[] = [
  { key: 'minimal', label: 'Minimal' },
  { key: 'normal', label: 'Normal' },
  { key: 'expressive', label: 'Expressif' },
]

const cornerOptions: { key: CornerStyle; label: string }[] = [
  { key: 'soft', label: '◡ Doux' },
  { key: 'sharp', label: '▢ Anguleux' },
]

const accentSwatches = [
  '#8f6cf2', '#f0538e', '#7c2f56', '#66914d', '#3b82c4', '#e08b2f', '#d64545', '#2ba38a',
]

const accentDraft = ref(theme.state.accentColor ?? '')

function applyAccentSwatch(hex: string) {
  accentDraft.value = hex
  theme.setAccentColor(hex)
}

function applyAccentInput() {
  if (/^#[0-9a-fA-F]{6}$/.test(accentDraft.value)) theme.setAccentColor(accentDraft.value)
}

function resetAccent() {
  accentDraft.value = ''
  theme.setAccentColor(null)
}

const customAccentDraft = ref(theme.state.customTheme.accentColor ?? '')

function applyCustomAccentSwatch(hex: string) {
  customAccentDraft.value = hex
  theme.updateCustomTheme({ accentColor: hex })
}

const customPreview = computed(() => theme.themes.find((t) => t.id === theme.state.customTheme.baseTheme) ?? theme.themes[0])

function useCustomTheme() {
  theme.setTheme('custom')
  closeThemePicker()
}

function close() {
  view.value = 'gallery'
  closeThemePicker()
}
</script>

<template>
  <Teleport to="body">
    <Transition name="fade-slide">
      <div
        v-if="ui.themePickerOpen"
        class="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-ink/40 px-4 py-10 backdrop-blur-[2px]"
        @mousedown.self="close"
      >
        <Transition name="pop" appear>
          <div
            v-if="ui.themePickerOpen"
            class="w-full max-w-4xl rounded-2xl bg-paper p-6 shadow-soft-lg ring-1 ring-ink/5 sm:p-8"
          >
            <!-- Gallery -->
            <template v-if="view === 'gallery'">
              <div class="flex items-start justify-between gap-4">
                <div>
                  <h2 class="font-display text-[24px] font-medium tracking-tight text-ink">
                    Personnaliser mon espace
                  </h2>
                  <p class="mt-1 text-[13.5px] text-ink-soft">
                    Construis ton propre espace de travail — le changement est instantané.
                  </p>
                </div>
                <button
                  type="button"
                  class="rounded-full p-1.5 text-ink-faint transition-colors hover:bg-lavender-50 hover:text-ink cursor-pointer"
                  @click="close"
                >
                  <IconX class="h-4.5 w-4.5" />
                </button>
              </div>

              <div class="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <ThemePreviewCard
                  v-for="t in theme.themes"
                  :key="t.id"
                  :id="t.id"
                  :emoji="t.emoji"
                  :label="t.label"
                  :tagline="t.tagline"
                  :mode="theme.state.mode"
                  :active="theme.state.themeId === t.id"
                  @select="theme.setTheme(t.id)"
                />

                <button
                  type="button"
                  class="flex h-full min-h-[13rem] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line p-6 text-center transition-colors hover:border-lavender-300 hover:bg-lavender-50/50 cursor-pointer"
                  :class="{ '!border-lavender-400 !bg-lavender-50': theme.state.themeId === 'custom' }"
                  @click="view = 'custom'"
                >
                  <span class="text-[26px]">✨</span>
                  <span class="font-display text-[14px] font-medium text-ink">Créer mon thème</span>
                  <span class="text-[11px] text-ink-faint">Compose ta propre ambiance</span>
                </button>
              </div>

              <div class="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <p class="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Couleur d'accent</p>
                  <div class="mt-2 flex flex-wrap items-center gap-2">
                    <button
                      v-for="c in accentSwatches"
                      :key="c"
                      type="button"
                      class="h-7 w-7 rounded-full border-2 transition-transform cursor-pointer"
                      :class="theme.state.accentColor === c ? 'scale-110 border-ink/30' : 'border-transparent'"
                      :style="{ backgroundColor: c }"
                      @click="applyAccentSwatch(c)"
                    />
                    <input
                      v-model="accentDraft"
                      type="color"
                      class="h-7 w-7 cursor-pointer rounded-full border border-line bg-transparent p-0"
                      @change="applyAccentInput"
                    />
                    <button
                      v-if="theme.state.accentColor"
                      type="button"
                      class="text-[11.5px] font-medium text-ink-faint hover:text-lavender-600 cursor-pointer"
                      @click="resetAccent"
                    >
                      Réinitialiser
                    </button>
                  </div>
                </div>

                <div>
                  <p class="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Mode</p>
                  <div class="mt-2 inline-flex items-center gap-1 rounded-xl bg-lavender-50 p-1">
                    <button
                      v-for="opt in modeOptions"
                      :key="opt.key"
                      type="button"
                      class="rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition-colors cursor-pointer"
                      :class="theme.state.mode === opt.key ? 'bg-white text-ink shadow-soft' : 'text-ink-faint hover:text-ink'"
                      @click="theme.setMode(opt.key)"
                    >
                      {{ opt.label }}
                    </button>
                  </div>
                </div>

                <div>
                  <p class="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Intensité visuelle</p>
                  <div class="mt-2 inline-flex items-center gap-1 rounded-xl bg-lavender-50 p-1">
                    <button
                      v-for="opt in intensityOptions"
                      :key="opt.key"
                      type="button"
                      class="rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition-colors cursor-pointer"
                      :class="
                        theme.state.visualIntensity === opt.key
                          ? 'bg-white text-ink shadow-soft'
                          : 'text-ink-faint hover:text-ink'
                      "
                      @click="theme.setVisualIntensity(opt.key)"
                    >
                      {{ opt.label }}
                    </button>
                  </div>
                </div>

                <div>
                  <p class="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Animations</p>
                  <button
                    type="button"
                    class="mt-2 flex items-center gap-2.5 rounded-xl border border-line px-3 py-2 text-[12.5px] font-medium text-ink-soft transition-colors hover:border-lavender-300 cursor-pointer"
                    @click="theme.setAnimationsEnabled(!theme.state.animationsEnabled)"
                  >
                    <span
                      class="relative h-4 w-7 shrink-0 rounded-full transition-colors"
                      :class="theme.state.animationsEnabled ? 'bg-lavender-500' : 'bg-ink/15'"
                    >
                      <span
                        class="absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all"
                        :class="theme.state.animationsEnabled ? 'left-3.5' : 'left-0.5'"
                      />
                    </span>
                    {{ theme.state.animationsEnabled ? 'Activées' : 'Désactivées' }}
                  </button>
                </div>
              </div>
            </template>

            <!-- Custom theme composer -->
            <template v-else>
              <button
                type="button"
                class="flex items-center gap-1.5 text-[13px] font-medium text-ink-faint transition-colors hover:text-lavender-600 cursor-pointer"
                @click="view = 'gallery'"
              >
                <IconChevronLeft class="h-4 w-4" />
                Retour
              </button>

              <div class="mt-3 flex items-start justify-between gap-4">
                <div>
                  <h2 class="font-display text-[22px] font-medium tracking-tight text-ink">✨ Créer mon thème</h2>
                  <p class="mt-1 text-[13px] text-ink-soft">Pars d'une ambiance, puis ajuste-la à ton goût.</p>
                </div>
                <button
                  type="button"
                  class="rounded-full p-1.5 text-ink-faint transition-colors hover:bg-lavender-50 hover:text-ink cursor-pointer"
                  @click="close"
                >
                  <IconX class="h-4.5 w-4.5" />
                </button>
              </div>

              <div class="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-[220px_1fr]">
                <ThemePreviewCard
                  :id="theme.state.customTheme.baseTheme"
                  :emoji="customPreview.emoji"
                  :label="customPreview.label"
                  :tagline="customPreview.tagline"
                  :mode="theme.state.customTheme.mode"
                  :active="true"
                  @select="() => {}"
                />

                <div class="flex flex-col gap-5">
                  <div>
                    <p class="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Ambiance de départ</p>
                    <div class="mt-2 flex flex-wrap gap-1.5">
                      <button
                        v-for="t in theme.themes"
                        :key="t.id"
                        type="button"
                        class="rounded-xl border px-3 py-1.5 text-[12.5px] font-medium transition-colors cursor-pointer"
                        :class="
                          theme.state.customTheme.baseTheme === t.id
                            ? 'border-lavender-300 bg-lavender-100 text-lavender-700'
                            : 'border-line text-ink-soft hover:border-lavender-200'
                        "
                        @click="theme.updateCustomTheme({ baseTheme: t.id })"
                      >
                        {{ t.emoji }} {{ t.label }}
                      </button>
                    </div>
                  </div>

                  <div>
                    <p class="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Couleur principale</p>
                    <div class="mt-2 flex flex-wrap items-center gap-2">
                      <button
                        v-for="c in accentSwatches"
                        :key="c"
                        type="button"
                        class="h-6.5 w-6.5 rounded-full border-2 transition-transform cursor-pointer"
                        :class="theme.state.customTheme.accentColor === c ? 'scale-110 border-ink/30' : 'border-transparent'"
                        :style="{ backgroundColor: c }"
                        @click="applyCustomAccentSwatch(c)"
                      />
                      <input
                        v-model="customAccentDraft"
                        type="color"
                        class="h-6.5 w-6.5 cursor-pointer rounded-full border border-line bg-transparent p-0"
                        @change="theme.updateCustomTheme({ accentColor: customAccentDraft })"
                      />
                    </div>
                  </div>

                  <div class="grid grid-cols-2 gap-5">
                    <div>
                      <p class="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Mode</p>
                      <div class="mt-2 flex flex-col gap-1">
                        <button
                          v-for="opt in modeOptions"
                          :key="opt.key"
                          type="button"
                          class="rounded-lg px-2.5 py-1.5 text-left text-[12px] font-medium transition-colors cursor-pointer"
                          :class="
                            theme.state.customTheme.mode === opt.key
                              ? 'bg-lavender-100 text-lavender-700'
                              : 'text-ink-faint hover:bg-lavender-50'
                          "
                          @click="theme.updateCustomTheme({ mode: opt.key })"
                        >
                          {{ opt.label }}
                        </button>
                      </div>
                    </div>

                    <div>
                      <p class="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Style des coins</p>
                      <div class="mt-2 flex flex-col gap-1">
                        <button
                          v-for="opt in cornerOptions"
                          :key="opt.key"
                          type="button"
                          class="rounded-lg px-2.5 py-1.5 text-left text-[12px] font-medium transition-colors cursor-pointer"
                          :class="
                            theme.state.customTheme.cornerStyle === opt.key
                              ? 'bg-lavender-100 text-lavender-700'
                              : 'text-ink-faint hover:bg-lavender-50'
                          "
                          @click="theme.updateCustomTheme({ cornerStyle: opt.key })"
                        >
                          {{ opt.label }}
                        </button>
                      </div>
                    </div>
                  </div>

                  <p class="rounded-xl bg-lavender-50 px-3 py-2.5 text-[11.5px] leading-relaxed text-lavender-700">
                    ✨ Bientôt : décris ton thème en une phrase ("un bureau rose années 2000 avec des étoiles") et
                    laisse Nook le composer pour toi.
                  </p>

                  <button
                    type="button"
                    class="self-start rounded-xl bg-lavender-500 px-4 py-2.5 text-[13px] font-medium text-white shadow-soft transition-colors hover:bg-lavender-600 cursor-pointer"
                    @click="useCustomTheme"
                  >
                    Utiliser ce thème
                  </button>
                </div>
              </div>
            </template>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>
