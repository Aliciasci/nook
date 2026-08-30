import type { Component } from 'vue'
import type { TimeBlockKind } from '@/types'
import IconBriefcase from '@/icons/IconBriefcase.vue'
import IconTarget from '@/icons/IconTarget.vue'
import IconUsers from '@/icons/IconUsers.vue'
import IconBook from '@/icons/IconBook.vue'
import IconDumbbell from '@/icons/IconDumbbell.vue'
import IconCoffee from '@/icons/IconCoffee.vue'
import IconListCheck from '@/icons/IconListCheck.vue'
import IconClock from '@/icons/IconClock.vue'

/**
 * L'icône d'une catégorie — à part du catalogue (`utils/activityKinds`) pour
 * qu'il reste des données pures, importables par le store et les calculs.
 */
const ICONS: Record<TimeBlockKind, Component> = {
  travail: IconBriefcase,
  focus: IconTarget,
  reunion: IconUsers,
  etude: IconBook,
  sport: IconDumbbell,
  pause: IconCoffee,
}

/**
 * L'icône d'un créneau : celle de sa catégorie, sinon une coche pour un
 * créneau de tâche et une horloge pour un bloc libre. Une carte sans icône
 * ferait un trou dans la colonne.
 */
export function activityIcon(kind: TimeBlockKind | null, hasItem: boolean): Component {
  if (kind && ICONS[kind]) return ICONS[kind]
  return hasItem ? IconListCheck : IconClock
}
