<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import AppHeader from '@/components/AppHeader.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import PromptDialog from '@/components/PromptDialog.vue'
import TabBar from '@/components/TabBar.vue'
import TaskSheet from '@/components/TaskSheet.vue'
import ToastHost from '@/components/ToastHost.vue'
import ConnectView from '@/views/ConnectView.vue'
import CreateView from '@/views/CreateView.vue'
import MaterialsView from '@/views/MaterialsView.vue'
import ModelsView from '@/views/ModelsView.vue'
import SettingsView from '@/views/SettingsView.vue'
import TasksView from '@/views/TasksView.vue'
import { useConfigStore } from '@/stores/config'
import { useModelsStore } from '@/stores/models'
import { useTasksStore } from '@/stores/tasks'
import { useUiStore } from '@/stores/ui'
import { isNative } from '@/api/bridge'
import type { AppView } from '@/app-view'

const config = useConfigStore()
const tasks = useTasksStore()
const models = useModelsStore()
const ui = useUiStore()
const logoUrl = './logo.png'

const VALID_VIEWS: AppView[] = ['tasks', 'models', 'materials', 'settings', 'create']
const view = ref<AppView>(readView())
const mainRef = ref<HTMLElement | null>(null)

const views = {
  tasks: TasksView,
  models: ModelsView,
  materials: MaterialsView,
  settings: SettingsView,
  create: CreateView,
} as const

const currentView = computed(() => views[view.value])
const showChrome = computed(() => config.connected && view.value !== 'create')

function readView(): AppView {
  const hash = window.location.hash.replace(/^#\/?/, '')
  if (hash === 'connect') return 'tasks'
  return VALID_VIEWS.includes(hash as AppView) ? (hash as AppView) : 'tasks'
}

function navigate(next: AppView): void {
  if (next === 'create' && !config.connected) {
    ui.toast('请先连接 XB-SVCB 服务', 'warn')
    return
  }
  view.value = next
  if (window.location.hash !== `#/${next}`) window.location.hash = `#/${next}`
  ui.haptic(8)
}

function syncHash(): void {
  const next = readView()
  if (next === 'create' && !config.connected) return
  view.value = next
}

async function bootstrap(): Promise<void> {
  // 本地开发/截图预览：允许通过 ?server=&key= 临时注入连接信息，APK 内不生效。
  const query = new URLSearchParams(window.location.search)
  const devServer = query.get('server')
  const devKey = query.get('key')
  try {
    if (!isNative && devServer && devKey && /^(127\.0\.0\.1|localhost)$/.test(window.location.hostname)) {
      await config.apply(devServer, devKey)
    } else {
      await config.load()
    }
  } catch {
    config.loaded = true
  }
  if (config.connected) {
    void tasks.load()
    void models.loadVoices()
    tasks.startPolling()
  }
}

function handleBack(): boolean {
  if (ui.promptState) {
    ui.answerPrompt(null)
    return true
  }
  if (ui.confirmState) {
    ui.answerConfirm(false)
    return true
  }
  if (ui.activeTaskId) {
    ui.closeTask()
    return true
  }
  if (view.value === 'create') {
    navigate('tasks')
    return true
  }
  if (view.value !== 'tasks') {
    navigate('tasks')
    return true
  }
  return false
}

function onVisibility(): void {
  if (document.hidden) return
  if (!config.connected) return
  void tasks.load(true)
}

onMounted(() => {
  void bootstrap()
  window.addEventListener('hashchange', syncHash)
  document.addEventListener('visibilitychange', onVisibility)
  ;(window as unknown as { __handleBack?: () => boolean }).__handleBack = handleBack
})

onBeforeUnmount(() => {
  tasks.stopPolling()
  window.removeEventListener('hashchange', syncHash)
  document.removeEventListener('visibilitychange', onVisibility)
})

// 连接成功后停留在“任务”，并把连接页的 hash 纠正回来。
function onConnected(): void {
  const hash = window.location.hash.replace(/^#\/?/, '')
  if (!hash || hash === 'connect') {
    navigate('tasks')
  } else if (VALID_VIEWS.includes(hash as AppView)) {
    view.value = hash as AppView
  }
  void tasks.load()
  void models.loadVoices()
  tasks.startPolling()
}

watch(
  () => config.connected,
  (value, previous) => {
    if (value && !previous) onConnected()
    if (!value && previous) tasks.stopPolling()
  },
)

// 切换页面时把主滚动容器归零，避免沿用上一页的滚动位置。
watch(view, async () => {
  await nextTick()
  mainRef.value?.scrollTo({ top: 0, behavior: 'auto' })
})
</script>

<template>
  <div class="app-shell">
    <div v-if="!config.loaded || config.initializing" class="boot-screen">
      <div class="boot-logo">
        <span class="boot-halo"></span>
        <img :src="logoUrl" alt="XB-SVCB" />
      </div>
      <p class="kicker">// XB-SVCB MOBILE</p>
      <p class="boot-text">
        {{ config.initializing ? '正在连接电脑端…' : '正在读取本地配置…' }}
      </p>
      <span class="spinner"></span>
    </div>
    <ConnectView v-else-if="!config.connected" @connected="onConnected" />
    <template v-else>
      <AppHeader v-if="showChrome" :view="view" />
      <main ref="mainRef" class="app-main scroll-area">
        <component :is="currentView" />
      </main>
      <TabBar v-if="showChrome" :view="view" @navigate="navigate" />
      <TaskSheet v-if="ui.activeTaskId" />
    </template>
    <ToastHost />
    <ConfirmDialog />
    <PromptDialog />
  </div>
</template>

<style scoped>
.app-main {
  position: relative;
  z-index: 1;
  flex: 1 1 auto;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}

.app-main::-webkit-scrollbar {
  display: none;
}

/* 桌面浏览器预览时保持手机版宽度，APK 内自然铺满。 */
.app-shell {
  width: 100%;
  max-width: 560px;
  margin: 0 auto;
}

@media (min-width: 600px) {
  body {
    background-image:
      radial-gradient(60% 50% at 50% 0%, rgba(var(--xb-primary-rgb), 0.06), transparent 70%),
      linear-gradient(90deg, rgba(var(--xb-bg-rgb), 1), rgba(var(--xb-bg-rgb), 0.92));
  }

  .app-shell {
    border-left: 1px solid var(--xb-border);
    border-right: 1px solid var(--xb-border);
    box-shadow: 0 0 80px rgba(0, 0, 0, 0.45);
  }
}

.boot-screen {
  position: relative;
  z-index: 1;
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 24px;
}

.boot-logo {
  position: relative;
  width: 84px;
  height: 84px;
  margin-bottom: 8px;
  border-radius: 50%;
  overflow: hidden;
  box-shadow: 0 16px 44px rgba(var(--xb-primary-rgb), 0.3);
}

.boot-logo img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}

.boot-halo {
  position: absolute;
  inset: -14px;
  border-radius: 34px;
  background: radial-gradient(circle, rgba(var(--xb-primary-rgb), 0.3), transparent 70%);
  filter: blur(8px);
  z-index: -1;
}

.boot-text {
  color: var(--xb-muted);
  font-size: 11px;
  letter-spacing: 0.3px;
}

.boot-screen .spinner {
  margin-top: 4px;
}
</style>
