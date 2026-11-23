<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'

import Icon from '@/components/Icon.vue'
import { useUiStore } from '@/stores/ui'

const ui = useUiStore()
const state = computed(() => ui.promptState)
const value = ref('')
const inputRef = ref<HTMLInputElement | null>(null)

watch(
  () => state.value,
  async (current) => {
    if (!current) return
    value.value = current.options.value || ''
    await nextTick()
    inputRef.value?.focus()
    inputRef.value?.select()
  },
)

function submit(): void {
  const text = value.value.trim()
  if (!text) return
  ui.answerPrompt(text)
}
</script>

<template>
  <Transition name="dialog">
    <div v-if="state" class="overlay" @click.self="ui.answerPrompt(null)">
      <div class="dialog">
        <div class="dialog-head">
          <div class="dialog-icon"><Icon name="edit" :size="18" /></div>
          <div>
            <h3>{{ state.options.title }}</h3>
            <p v-if="state.options.message" class="message">{{ state.options.message }}</p>
          </div>
        </div>
        <input
          ref="inputRef"
          v-model="value"
          class="input"
          type="text"
          :placeholder="state.options.placeholder || '请输入'"
          :maxlength="state.options.maxLength || 120"
          enterkeyhint="done"
          @keyup.enter="submit"
        />
        <div class="actions">
          <button class="btn btn--ghost" type="button" @click="ui.answerPrompt(null)">取消</button>
          <button class="btn btn--primary" type="button" :disabled="!value.trim()" @click="submit">
            {{ state.options.confirmText || '保存' }}
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
  z-index: 85;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(3, 5, 12, 0.62);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}

.dialog {
  width: min(100%, 340px);
  padding: 18px;
  border: 1px solid var(--xb-border);
  border-radius: 18px;
  background: var(--xb-bg-2);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.5);
}

.dialog-head {
  display: flex;
  gap: 10px;
  margin-bottom: 13px;
}

.dialog-icon {
  display: grid;
  place-items: center;
  flex: none;
  width: 38px;
  height: 38px;
  border-radius: 12px;
  background: rgba(var(--xb-primary-rgb), 0.1);
  color: var(--xb-primary);
}

h3 {
  font-size: 15px;
  font-weight: 800;
  line-height: 1.35;
}

.message {
  margin-top: 3px;
  color: var(--xb-muted);
  font-size: 11px;
  line-height: 1.5;
}

.actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 9px;
  margin-top: 14px;
}

.dialog-enter-active,
.dialog-leave-active {
  transition: opacity 0.18s ease;
}

.dialog-enter-from,
.dialog-leave-to {
  opacity: 0;
}
</style>
