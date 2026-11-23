<script setup lang="ts">
import Icon from '@/components/Icon.vue'
import { t } from '@/i18n'
import type { AppView } from '@/app-view'

defineProps<{ view: AppView }>()
const emit = defineEmits<{ (event: 'navigate', view: AppView): void }>()

const TABS: { key: AppView; icon: string }[] = [
  { key: 'tasks', icon: 'tasks' },
  { key: 'models', icon: 'chip' },
  { key: 'materials', icon: 'download' },
  { key: 'settings', icon: 'sliders' },
]
</script>

<template>
  <nav class="tabbar">
    <button
      v-for="tab in TABS"
      :key="tab.key"
      class="tab"
      :class="{ on: view === tab.key }"
      type="button"
      @click="emit('navigate', tab.key)"
    >
      <span class="tab-icon">
        <Icon :name="tab.icon" :size="21" :stroke-width="view === tab.key ? 2 : 1.7" />
      </span>
      <span class="tab-label">{{ t(`nav.${tab.key}`) }}</span>
      <span class="tab-dot"></span>
    </button>
  </nav>
</template>

<style scoped>
.tabbar {
  position: relative;
  z-index: 20;
  display: flex;
  flex: 0 0 auto;
  align-items: stretch;
  padding: 6px 8px calc(6px + env(safe-area-inset-bottom));
  border-top: 1px solid rgba(var(--xb-primary-rgb), 0.12);
  background: linear-gradient(0deg, rgba(var(--xb-bg-rgb), 0.98), rgba(var(--xb-bg-rgb), 0.82));
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}

.tab {
  position: relative;
  display: flex;
  flex: 1 1 0;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  height: 52px;
  border-radius: 14px;
  color: var(--xb-muted);
  transition: color 0.18s ease, background 0.18s ease;
}

.tab:active {
  background: rgba(var(--xb-primary-rgb), 0.06);
}

.tab.on {
  color: var(--xb-primary);
}

.tab-icon {
  position: relative;
  display: grid;
  place-items: center;
  width: 34px;
  height: 26px;
}

.tab.on .tab-icon::before {
  content: '';
  position: absolute;
  inset: -2px -4px;
  border-radius: 10px;
  background: rgba(var(--xb-primary-rgb), 0.11);
  box-shadow: 0 0 18px rgba(var(--xb-primary-rgb), 0.18);
}

.tab-icon :deep(svg) {
  position: relative;
  z-index: 1;
}

.tab-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.3px;
  opacity: 0.86;
}

.tab.on .tab-label {
  opacity: 1;
}

.tab-dot {
  position: absolute;
  top: 2px;
  width: 14px;
  height: 2px;
  border-radius: 2px;
  background: transparent;
}

.tab.on .tab-dot {
  background: var(--xb-brand-gradient);
  box-shadow: 0 0 10px rgba(var(--xb-primary-rgb), 0.7);
}
</style>
