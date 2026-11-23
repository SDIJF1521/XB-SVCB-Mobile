import { createPinia } from 'pinia'
import { createApp, nextTick, watch } from 'vue'

import App from './App.vue'
import { locale } from './i18n'
import { applyAutoI18n } from './i18n/auto'
import { usePrefsStore } from './stores/prefs'
import './style.css'

const app = createApp(App)
app.use(createPinia())
usePrefsStore().apply()
app.mount('#app')

watch(locale, async (value) => {
  await nextTick()
  applyAutoI18n(value)
})
void nextTick().then(() => applyAutoI18n(locale.value))
