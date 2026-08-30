<script setup lang="ts">
import { useStore } from '@/store/useStore'
import QuickAddField from '@/components/common/QuickAddField.vue'

const props = withDefaults(
  defineProps<{ folderId?: string | null; type?: 'task' | 'note'; placeholder?: string }>(),
  { folderId: null, type: 'task', placeholder: 'Ajouter rapidement…' },
)

const { addTask, addNote } = useStore()

function submit(title: string) {
  if (props.type === 'task') addTask({ title, folderId: props.folderId })
  else addNote({ title, folderId: props.folderId })
}
</script>

<template>
  <QuickAddField :placeholder="placeholder" @submit="submit" />
</template>
