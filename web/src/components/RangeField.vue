<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    label: string
    modelValue: number
    min?: number
    max?: number
    step?: number
    format?: (value: number) => string
    hint?: string
  }>(),
  { min: 0, max: 1, step: 0.01, hint: '' },
)

const emit = defineEmits<{ (event: 'update:modelValue', value: number): void }>()

const display = computed(() => (props.format ? props.format(props.modelValue) : String(props.modelValue)))
const progress = computed(() => {
  const span = props.max - props.min
  if (span <= 0) return 0
  return ((props.modelValue - props.min) / span) * 100
})

function onInput(event: Event): void {
  emit('update:modelValue', Number((event.target as HTMLInputElement).value))
}
</script>

<template>
  <label class="range-field">
    <span class="range-head">
      <span class="range-label">{{ label }}</span>
      <b class="range-value mono">{{ display }}</b>
    </span>
    <input
      class="range-input"
      type="range"
      :min="min"
      :max="max"
      :step="step"
      :value="modelValue"
      :style="{ '--range-progress': `${progress}%` }"
      @input="onInput"
    />
    <span v-if="hint" class="range-hint">{{ hint }}</span>
  </label>
</template>

<style scoped>
.range-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.range-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.range-label {
  color: var(--xb-text);
  font-size: 10.5px;
  font-weight: 700;
}

.range-value {
  color: var(--xb-primary);
  font-size: 10.5px;
  font-weight: 700;
}

.range-input {
  width: 100%;
  height: 22px;
  margin: 0;
  appearance: none;
  -webkit-appearance: none;
  background: transparent;
}

.range-input::-webkit-slider-runnable-track {
  height: 3px;
  border-radius: 999px;
  background: linear-gradient(
    90deg,
    rgba(var(--xb-primary-rgb), 0.72) var(--range-progress),
    rgba(var(--xb-fill-rgb), 0.14) var(--range-progress)
  );
}

.range-input::-webkit-slider-thumb {
  width: 14px;
  height: 14px;
  margin-top: -5.5px;
  appearance: none;
  -webkit-appearance: none;
  border: 2px solid var(--xb-bg-2);
  border-radius: 50%;
  background: var(--xb-primary);
  box-shadow: 0 0 8px rgba(var(--xb-primary-rgb), 0.55);
}

.range-hint {
  color: var(--xb-muted);
  font-size: 8.5px;
  line-height: 1.45;
}
</style>
