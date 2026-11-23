<script setup lang="ts">
import Icon from '@/components/Icon.vue'
import { useUiStore } from '@/stores/ui'

const ui = useUiStore()

const ICONS: Record<string, string> = {
  info: 'info',
  success: 'check',
  error: 'alert',
  warn: 'alert',
}
</script>

<template>
  <div class="toast-host" aria-live="polite">
    <TransitionGroup name="toast">
      <button
        v-for="item in ui.toasts"
        :key="item.id"
        class="toast"
        :class="`toast--${item.kind}`"
        type="button"
        @click="ui.dismissToast(item.id)"
      >
        <span class="toast-icon">
          <Icon :name="ICONS[item.kind] || 'info'" :size="15" :stroke-width="2" />
        </span>
        <span>{{ item.message }}</span>
      </button>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-host {
  position: fixed;
  top: calc(58px + env(safe-area-inset-top));
  left: 50%;
  z-index: 90;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  width: min(92vw, 420px);
  transform: translateX(-50%);
  pointer-events: none;
}

.toast {
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: 100%;
  padding: 9px 13px 9px 10px;
  border: 1px solid var(--xb-border);
  border-radius: 12px;
  background: var(--xb-bg-2);
  box-shadow: 0 14px 34px rgba(0, 0, 0, 0.42);
  color: var(--xb-text);
  font-size: 12px;
  font-weight: 600;
  text-align: left;
  pointer-events: auto;
}

.toast-icon {
  display: grid;
  place-items: center;
  flex: none;
  width: 24px;
  height: 24px;
  border-radius: 8px;
  background: rgba(var(--xb-primary-rgb), 0.12);
  color: var(--xb-primary);
}

.toast--success .toast-icon {
  background: rgba(var(--xb-success-rgb), 0.12);
  color: var(--xb-success);
}

.toast--error .toast-icon,
.toast--warn .toast-icon {
  background: rgba(var(--xb-danger-rgb), 0.12);
  color: var(--xb-danger);
}

.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.97);
}
</style>
