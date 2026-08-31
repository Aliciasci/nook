<script setup lang="ts">
/**
 * Le sélecteur de boards, en onglets — créer, renommer (double-clic ou double
 * tap), supprimer (avec confirmation, irréversible).
 */
import { nextTick, ref } from 'vue'
import { useVisionBoards } from '@/store/useVisionBoards'
import IconPlus from '@/icons/IconPlus.vue'
import IconX from '@/icons/IconX.vue'

const board = useVisionBoards()

const renamingId = ref<string | null>(null)
const renameDraft = ref('')
const renameInput = ref<HTMLInputElement>()

const confirmingId = ref<string | null>(null)

const creating = ref(false)
const createDraft = ref('')
const createInput = ref<HTMLInputElement>()

function startRename(id: string, currentName: string) {
  confirmingId.value = null
  renamingId.value = id
  renameDraft.value = currentName
  void nextTick(() => renameInput.value?.focus())
}

function commitRename() {
  const id = renamingId.value
  renamingId.value = null
  if (!id) return
  const name = renameDraft.value.trim()
  if (name) board.renameBoard(id, name)
}

function startCreate() {
  confirmingId.value = null
  creating.value = true
  createDraft.value = ''
  void nextTick(() => createInput.value?.focus())
}

async function commitCreate() {
  const name = createDraft.value.trim()
  creating.value = false
  if (!name) return
  const created = await board.createBoard(name)
  if (created) board.setCurrentBoard(created.id)
}

async function confirmDelete(id: string) {
  confirmingId.value = null
  await board.removeBoard(id)
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-1.5">
    <div v-for="b in board.boards.value" :key="b.id" class="group/tab relative">
      <input
        v-if="renamingId === b.id"
        ref="renameInput"
        v-model="renameDraft"
        type="text"
        maxlength="60"
        class="w-32 rounded-xl border border-lavender-300 bg-white px-3 py-1.5 text-[12.5px] font-medium text-ink outline-none ring-2 ring-lavender-100"
        @keydown.enter.prevent="commitRename"
        @keydown.esc.prevent="renamingId = null"
        @blur="commitRename"
      />
      <div
        v-else
        class="flex items-center rounded-xl transition-colors"
        :class="b.id === board.currentBoardId.value ? 'bg-lavender-100 text-lavender-700' : 'text-ink-soft hover:bg-lavender-50 hover:text-ink'"
      >
        <button
          type="button"
          class="max-w-[10rem] truncate rounded-xl py-1.5 pl-3 pr-1 text-[12.5px] font-medium cursor-pointer"
          @click="board.setCurrentBoard(b.id)"
          @dblclick="startRename(b.id, b.name)"
        >
          {{ b.name }}
        </button>
        <button
          type="button"
          title="Supprimer ce board"
          aria-label="Supprimer ce board"
          class="rounded-lg p-1 mr-1 opacity-0 transition-opacity hover:bg-rose-100 hover:text-rose-600 group-hover/tab:opacity-100 cursor-pointer"
          @click.stop="confirmingId = confirmingId === b.id ? null : b.id"
        >
          <IconX class="h-3 w-3" />
        </button>
      </div>

      <Transition name="pop">
        <div
          v-if="confirmingId === b.id"
          class="absolute left-0 top-[calc(100%+0.375rem)] z-30 w-56 rounded-xl bg-white p-3 shadow-soft-lg ring-1 ring-ink/[0.08]"
        >
          <p class="text-[12px] leading-snug text-ink-soft">
            Supprimer « {{ b.name }} » efface tous ses éléments. C'est irréversible.
          </p>
          <div class="mt-2 flex justify-end gap-1.5">
            <button
              type="button"
              class="rounded-lg px-2.5 py-1 text-[12px] font-medium text-ink-faint hover:bg-paper cursor-pointer"
              @click="confirmingId = null"
            >
              Annuler
            </button>
            <button
              type="button"
              class="rounded-lg bg-rose-600 px-2.5 py-1 text-[12px] font-medium text-white hover:bg-rose-700 cursor-pointer"
              @click="confirmDelete(b.id)"
            >
              Supprimer
            </button>
          </div>
        </div>
      </Transition>
    </div>

    <input
      v-if="creating"
      ref="createInput"
      v-model="createDraft"
      type="text"
      maxlength="60"
      placeholder="Nom du board"
      class="w-32 rounded-xl border border-lavender-300 bg-white px-3 py-1.5 text-[12.5px] text-ink outline-none ring-2 ring-lavender-100"
      @keydown.enter.prevent="commitCreate"
      @keydown.esc.prevent="creating = false"
      @blur="commitCreate"
    />
    <button
      v-else
      type="button"
      title="Nouveau board"
      class="flex shrink-0 items-center gap-1.5 rounded-xl border border-line bg-white px-3 py-1.5 text-[12.5px] font-medium text-ink-soft shadow-soft transition-colors hover:border-lavender-300 hover:text-lavender-600 cursor-pointer"
      @click="startCreate"
    >
      <IconPlus class="h-3.5 w-3.5" />
      Nouveau board
    </button>
  </div>
</template>
