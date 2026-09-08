<script setup lang="ts">
import { useStore } from '@/store/useStore'
import QuickAddField from '@/components/common/QuickAddField.vue'
import type { ItemStatus } from '@/types'

const props = withDefaults(
  defineProps<{ folderId?: string | null; type?: 'task' | 'note'; status?: ItemStatus; placeholder?: string }>(),
  { folderId: null, type: 'task', status: undefined, placeholder: 'Ajouter rapidement…' },
)

const { addTask, addNote } = useStore()

function submit(title: string) {
  if (props.type === 'task') addTask({ title, folderId: props.folderId, status: props.status })
  else addNote({ title, folderId: props.folderId })
}
</script>

<template>
  <QuickAddField :placeholder="placeholder" @submit="submit" />
</template>
