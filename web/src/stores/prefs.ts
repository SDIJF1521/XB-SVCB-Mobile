import { defineStore } from 'pinia'
import { ref } from 'vue'

export type MobileTheme = 'cyber' | 'brand' | 'anime'

const THEME_KEY = 'xb-svcb.mobile.theme'
const VALID: MobileTheme[] = ['cyber', 'brand', 'anime']

/** 外观偏好：与桌面端一致的三套主题，立即生效并本地保留。 */
export const usePrefsStore = defineStore('mobile-prefs', () => {
  const theme = ref<MobileTheme>(readTheme())

  function readTheme(): MobileTheme {
    try {
      const stored = localStorage.getItem(THEME_KEY) as MobileTheme | null
      return stored && VALID.includes(stored) ? stored : 'cyber'
    } catch {
      // 某些 WebView 配置下 file:// 页面禁用 localStorage，退回默认主题。
      return 'cyber'
    }
  }

  function apply(): void {
    document.documentElement.dataset.theme = theme.value
  }

  function setTheme(value: MobileTheme): void {
    theme.value = value
    try {
      localStorage.setItem(THEME_KEY, value)
    } catch {
      // 无法持久化时仅本次会话生效。
    }
    apply()
  }

  return { theme, apply, setTheme }
})
