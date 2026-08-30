<script setup lang="ts">
import { useStore } from '@/store/useStore'
import PageHeader from '@/components/common/PageHeader.vue'
import InboxList from '@/components/inbox/InboxList.vue'
import QuickAddButton from '@/components/common/QuickAddButton.vue'
import SelectModeToggle from '@/components/common/SelectModeToggle.vue'

const { inboxItems } = useStore()
</script>

<template>
  <div class="page-sheet mx-auto max-w-2xl px-8 py-9">
    <PageHeader
      title="Inbox"
      :subtitle="`${inboxItems.length} élément${inboxItems.length > 1 ? 's' : ''} à classer.`"
    >
      <SelectModeToggle scope="inbox" />
      <QuickAddButton />
    </PageHeader>

    <div class="mt-7 rounded-2xl bg-white p-4 shadow-soft ring-1 ring-ink/[0.08]">
      <InboxList selection-scope="inbox" />
    </div>
  </div>
</template>
