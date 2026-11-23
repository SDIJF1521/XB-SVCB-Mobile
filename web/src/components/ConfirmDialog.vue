<script setup lang="ts">
import { computed } from 'vue'

import Icon from '@/components/Icon.vue'
import { useUiStore } from '@/stores/ui'

const ui = useUiStore()
const state = computed(() => ui.confirmState)
</script>

<template>
  <Transition name="dialog">
    <div v-if="state" class="overlay" @click.self="ui.answerConfirm(false)">
      <div class="dialog">
        <div class="dialog-icon" :class="{ danger: state.options.danger }">
          <Icon :name="state.options.danger ? 'alert' : 'info'" :size="20" />
        </div>
        <h3>{{ state.options.title }}</h3>
        <p class="message">{{ state.options.message }}</p>
        <div class="actions">
          <button class="btn btn--ghost" type="button" @click="ui.answerConfirm(false)">
            {{ state.options.cancelText || '取消' }}
          </button>
          <button
            class="btn"
            :class="state.options.danger ? 'btn--danger' : 'btn--primary'"
            type="button"
            @click="ui.answerConfirm(true)"
          >
            {{ state.options.confirmText || '确定' }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(3, 5, 12, 0.62);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}

.dialog {
  width: min(100%, 330px);
  padding: 20px 18px 16px;
  border: 1px solid var(--xb-border);
  border-radius: 18px;
  background: var(--xb-bg-2);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.5);
  text-align: center;
}

.dialog-icon {
  display: grid;
  place-items: center;
  width: 46px;
  height: 46px;
  margin: 0 auto 10px;
  border-radius: 15px;
  background: rgba(var(--xb-primary-rgb), 0.1);
  color: var(--xb-primary);
}

.dialog-icon.danger {
  background: rgba(var(--xb-danger-rgb), 0.12);
  color: var(--xb-danger);
}

h3 {
  font-size: 15px;
  font-weight: 800;
}

.message {
  margin-top: 6px;
  color: var(--xb-muted);
  font-size: 12px;
  line-height: 1.65;
  white-space: pre-line;
}

.actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 9px;
  margin-top: 18px;
}

.dialog-enter-active,
.dialog-leave-active {
  transition: opacity 0.18s ease;
}

.dialog-enter-active .dialog,
.dialog-leave-active .dialog {
  transition: transform 0.18s ease;
}

.dialog-enter-from,
.dialog-leave-to {
  opacity: 0;
}

.dialog-enter-from .dialog,
.dialog-leave-to .dialog {
  transform: scale(0.95);
}
</style>
