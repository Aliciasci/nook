import { createApp } from 'vue'
import './style.css'
import './themes/index.css'
import './components/garden/garden-animations.css'
import App from './App.vue'
import router from './router'
import { useTheme } from '@/composables/useTheme'
import { useBackground } from '@/composables/useBackground'

useTheme().init()
useBackground().init()

createApp(App).use(router).mount('#app')
