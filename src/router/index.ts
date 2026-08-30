import { createRouter, createWebHistory } from 'vue-router'
import { authReady, useAuth } from '@/composables/useAuth'
import { ensureNooksLoaded, useNooks } from '@/composables/useNooks'

declare module 'vue-router' {
  interface RouteMeta {
    public?: boolean
    /**
     * Identité de vue pour `AppLayout` : deux routes qui la partagent ne
     * remontent pas le composant quand on passe de l'une à l'autre.
     */
    viewKey?: string
  }
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior() {
    return { top: 0 }
  },
  routes: [
    { path: '/login', name: 'login', component: () => import('@/views/auth/LoginView.vue'), meta: { public: true } },
    { path: '/register', name: 'register', component: () => import('@/views/auth/RegisterView.vue'), meta: { public: true } },
    {
      path: '/forgot-password',
      name: 'forgot-password',
      component: () => import('@/views/auth/ForgotPasswordView.vue'),
      meta: { public: true },
    },
    {
      path: '/reset-password',
      name: 'reset-password',
      component: () => import('@/views/auth/ResetPasswordView.vue'),
      meta: { public: true },
    },
    // Hors `AppLayout` : le choix du nook précède l'espace de travail, il n'a
    // ni sidebar ni contenu à afficher derrière lui.
    {
      path: '/nooks',
      name: 'nook-picker',
      component: () => import('@/views/NookPickerView.vue'),
    },
    {
      path: '/',
      component: () => import('@/components/layout/AppLayout.vue'),
      children: [
        { path: '', name: 'home', component: () => import('@/views/HomeView.vue') },
        { path: 'inbox', name: 'inbox', component: () => import('@/views/InboxView.vue') },
        { path: 'today', name: 'today', component: () => import('@/views/TodayView.vue') },
        { path: 'planning', name: 'planning', component: () => import('@/views/PlanningView.vue') },
        { path: 'todo', name: 'todo', component: () => import('@/views/TodoView.vue') },
        { path: 'done', name: 'done', component: () => import('@/views/DoneView.vue') },
        { path: 'mon-espace', name: 'mon-espace', component: () => import('@/views/MonEspaceView.vue') },
        {
          path: 'docs',
          name: 'docs',
          component: () => import('@/views/DocsView.vue'),
          meta: { viewKey: 'docs' },
        },
        {
          path: 'docs/:id',
          name: 'doc-page',
          component: () => import('@/views/DocsView.vue'),
          meta: { viewKey: 'docs' },
        },
        { path: 'rapport', name: 'report', component: () => import('@/views/ReportView.vue') },
        { path: 'folder/:id', name: 'folder', component: () => import('@/views/FolderView.vue') },
        { path: 'settings', name: 'settings', component: () => import('@/views/SettingsView.vue') },
      ],
    },
  ],
})

router.beforeEach(async (to) => {
  await authReady
  const { isAuthenticated } = useAuth()
  const isPublic = to.meta.public === true

  if (!isPublic && !isAuthenticated.value) {
    return { name: 'login', query: to.fullPath !== '/' ? { redirect: to.fullPath } : undefined }
  }
  // Recovery links land an authenticated (recovery) session on this page on
  // purpose — never bounce it away like a normal already-logged-in visit.
  if (isPublic && isAuthenticated.value && to.name !== 'reset-password') {
    return { name: 'home' }
  }
  if (isPublic) return true

  // Aucune vue authentifiée ne peut s'afficher avant que le nook soit résolu :
  // les stores filtrent toutes leurs lectures dessus.
  await ensureNooksLoaded()
  const nooks = useNooks()

  if (to.name === 'nook-picker') return true

  // Le compte n'a aucun nook — le trigger de provisioning aurait dû en poser
  // un. L'écran de choix sait le rattraper en en proposant la création.
  if (!nooks.activeId.value) return { name: 'nook-picker' }

  // Un seul nook : il n'y a rien à choisir, on entre directement.
  if (nooks.nooks.value.length <= 1) {
    nooks.markPickedThisSession()
    return true
  }

  if (!nooks.hasPickedThisSession()) {
    return { name: 'nook-picker', query: to.fullPath !== '/' ? { redirect: to.fullPath } : undefined }
  }
  return true
})

export default router
