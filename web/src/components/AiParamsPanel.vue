<script setup lang="ts">
import RangeField from '@/components/RangeField.vue'
import { defaultAiParams, type AiParamsState } from '@/types/create'

const props = defineProps<{ params: AiParamsState }>()

type AiSliderKey =
  | 'pitchCorrection'
  | 'timingAlignment'
  | 'timbreFocus'
  | 'aiEq'
  | 'aiCompressor'
  | 'aiExciter'
  | 'stereoWidth'
  | 'loudnessEnvelope'

const SLIDERS: { key: AiSliderKey; label: string; hint: string }[] = [
  { key: 'pitchCorrection', label: '自然修音', hint: '只收敛音高漂移，保留颤音与滑音。' },
  { key: 'timingAlignment', label: 'AI 对齐', hint: '按停顿与音素对齐，校正抢拍和拖拍。' },
  { key: 'timbreFocus', label: '音色共振峰', hint: '强化转换声音自身的稳定共振峰。' },
  { key: 'aiEq', label: 'AI EQ', hint: '按人声频谱做保守宽带校正。' },
  { key: 'aiCompressor', label: 'AI 压缩', hint: '自动设定阈值并补偿响度。' },
  { key: 'aiExciter', label: 'AI 激励', hint: '抑制齿音后生成少量高频谐波。' },
  { key: 'stereoWidth', label: '立体声宽度', hint: '低频保持居中，保证单声道兼容。' },
  { key: 'loudnessEnvelope', label: '响度包络', hint: '恢复自然起伏，避开停顿与噪声。' },
]

function valueOf(key: AiSliderKey): number {
  return props.params[key]
}

function setValue(key: AiSliderKey, value: number): void {
  props.params[key] = value
}

function reset(): void {
  const defaults = defaultAiParams()
  for (const slider of SLIDERS) {
    setValue(slider.key, defaults[slider.key])
  }
}
</script>

<template>
  <div class="ai-params">
    <div class="level-row">
      <div class="segmented">
        <button :class="{ on: params.level === 'basic' }" type="button" @click="params.level = 'basic'">基础</button>
        <button :class="{ on: params.level === 'advanced' }" type="button" @click="params.level = 'advanced'">进阶</button>
      </div>
      <button class="reset" type="button" @click="reset">恢复默认</button>
    </div>

    <RangeField
      v-for="slider in SLIDERS"
      :key="slider.key"
      :model-value="valueOf(slider.key)"
      :label="slider.label"
      :min="0"
      :max="1"
      :step="0.01"
      :format="(value) => value.toFixed(2)"
      :hint="slider.hint"
      @update:model-value="(value) => setValue(slider.key, value)"
    />
  </div>
</template>

<style scoped>
.ai-params {
  display: flex;
  flex-direction: column;
  gap: 11px;
}

.level-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.level-row .segmented {
  flex: 1 1 auto;
}

.reset {
  flex: none;
  color: var(--xb-muted);
  font-size: 9.5px;
  font-weight: 700;
}
</style>
