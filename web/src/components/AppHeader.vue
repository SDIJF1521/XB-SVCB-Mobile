<script setup lang="ts">
import { computed } from 'vue'

import Icon from '@/components/Icon.vue'
import { t } from '@/i18n'
import { useConfigStore } from '@/stores/config'
import type { AppView } from '@/app-view'

const logoUrl = './logo.png'

const props = defineProps<{ view: AppView }>()
const config = useConfigStore()

const statusText = computed(() => {
  if (config.connecting) return t('status.connecting')
  if (!config.connected) return t('status.offline')
  if (config.system?.ready) return t('status.ready')
  return t('status.connected')
})

const online = computed(() => config.connected && !config.connecting)

function goSettings(): void {
  window.location.hash = '#/settings'
}

function goCreate(): void {
  window.location.hash = '#/create'
}
</script>

<template>
  <header class="app-header">
    <div class="brand">
      <div class="logo">
        <img :src="logoUrl" alt="XB-SVCB" />
      </div>
      <div class="brand-text">
        <b>XB-SVCB</b>
        <span>{{ t('app.subtitle') }}</span>
      </div>
    </div>
    <div class="head-actions">
      <button
        class="status-pill"
        :class="{ 'is-online': online, 'is-offline': !config.connected }"
        type="button"
        @click="goSettings"
      >
        <span class="dot" :class="{ 'dot--pulse': online }"></span>
        {{ statusText }}
      </button>
      <button class="create-pill" type="button" @click="goCreate">
        <Icon name="plus" :size="16" :stroke-width="2.4" />
        {{ t('common.create') }}
      </button>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  position: relative;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex: 0 0 auto;
  padding: calc(8px + env(safe-area-inset-top)) 16px 9px;
  background: linear-gradient(180deg, rgba(var(--xb-bg-rgb), 0.94), rgba(var(--xb-bg-rgb), 0.6));
  border-bottom: 1px solid rgba(var(--xb-primary-rgb), 0.1);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
}

.brand {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
}

.logo {
  position: relative;
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  overflow: hidden;
  box-shadow: 0 6px 18px rgba(var(--xb-primary-rgb), 0.28);
}

.logo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.brand-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
  line-height: 1.15;
}

.brand-text b {
  font-size: 15px;
  font-weight: 900;
  letter-spacing: 0.4px;
}

.brand-text span {
  color: var(--xb-muted);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 1.6px;
}

.head-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 10px;
  border: 1px solid var(--xb-border);
  border-radius: 999px;
  background: rgba(var(--xb-fill-rgb), 0.04);
  color: var(--xb-muted);
  font-size: 10px;
  font-weight: 700;
  white-space: nowrap;
}

.status-pill.is-online {
  border-color: rgba(var(--xb-success-rgb), 0.32);
  background: rgba(var(--xb-success-rgb), 0.08);
  color: var(--xb-success);
}

.status-pill.is-offline {
  border-color: rgba(var(--xb-danger-rgb), 0.36);
  background: rgba(var(--xb-danger-rgb), 0.08);
  color: var(--xb-danger);
}

.head-settings {
  width: 34px;
  height: 34px;
  border-radius: 10px;
}

.create-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 34px;
  padding: 0 12px;
  border-radius: 11px;
  background: var(--xb-brand-gradient);
  color: var(--xb-on-primary);
  font-size: 11px;
  font-weight: 800;
  box-shadow: 0 6px 18px rgba(var(--xb-primary-rgb), 0.3);
}

.create-pill:active {
  transform: scale(0.95);
}
</style>
