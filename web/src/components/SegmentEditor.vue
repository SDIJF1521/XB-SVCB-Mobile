<script setup lang="ts">
import { computed } from 'vue'

import Icon from '@/components/Icon.vue'
import type { VoiceModel } from '@/api/types'
import { newSegment, type SegmentDraft } from '@/types/create'

const props = defineProps<{
  models: VoiceModel[]
  duration: number
  segments: SegmentDraft[]
}>()

const emit = defineEmits<{ (event: 'update:segments', value: SegmentDraft[]): void }>()

const COLORS = ['#00f0ff', '#ff4faf', '#2f6bff', '#19f59a', '#ffae00']

const issue = computed(() => {
  if (!props.segments.length) return '至少需要一个演唱分段'
  const ordered = [...props.segments].sort((a, b) => a.start - b.start)
  let previousEnd = -1
  for (const segment of ordered) {
    if (!Number.isFinite(segment.start) || !Number.isFinite(segment.end)) {
      return '分段起止必须是有效秒数'
    }
    if (segment.end <= segment.start) return '存在结束时间不晚于开始时间的分段'
    if (previousEnd >= 0 && segment.start < previousEnd - 0.01) return '分段之间存在重叠'
    if (!segment.modelIds.length) return '每个分段至少选择一个模型'
    previousEnd = segment.end
  }
  return ''
})

const total = computed(() => {
  const last = props.segments.reduce((max, segment) => Math.max(max, segment.end), 0)
  return Math.max(props.duration, last, 1)
})

function clone(): SegmentDraft[] {
  return props.segments.map((segment) => ({ ...segment, modelIds: [...segment.modelIds] }))
}

function commit(next: SegmentDraft[]): void {
  emit('update:segments', next)
}

function updateTime(index: number, field: 'start' | 'end', value: number): void {
  if (!Number.isFinite(value)) return
  const next = clone()
  next[index][field] = Math.max(0, Math.round(value * 10) / 10)
  commit(next)
}

function onTimeChange(index: number, field: 'start' | 'end', event: Event): void {
  updateTime(index, field, Number((event.target as HTMLInputElement).value))
}

function toggleModel(index: number, modelId: string): void {
  const next = clone()
  const segment = next[index]
  if (!segment) return
  if (segment.modelIds.includes(modelId)) {
    segment.modelIds = segment.modelIds.filter((id) => id !== modelId)
  } else {
    segment.modelIds.push(modelId)
  }
  commit(next)
}

function addSegment(): void {
  const lastEnd = props.segments.reduce((max, segment) => Math.max(max, segment.end), 0)
  const end = props.duration > lastEnd
    ? Math.min(props.duration, lastEnd + 30)
    : lastEnd + 30
  const fallback = props.models[0]?.id
  commit([...clone(), newSegment(lastEnd, Math.max(end, lastEnd + 1), fallback ? [fallback] : [])])
}

function removeSegment(index: number): void {
  if (props.segments.length <= 1) return
  commit(clone().filter((_, position) => position !== index))
}

function splitEvenly(): void {
  const count = Math.max(2, Math.min(4, props.models.length))
  const length = props.duration > 0 ? props.duration : Math.max(60, total.value)
  const step = length / count
  const next: SegmentDraft[] = []
  for (let index = 0; index < count; index += 1) {
    const start = Math.round(index * step * 10) / 10
    const end = Math.round((index === count - 1 ? length : (index + 1) * step) * 10) / 10
    next.push(newSegment(start, end, [props.models[index % props.models.length].id]))
  }
  commit(next)
}

function formatSeconds(value: number): string {
  if (!Number.isFinite(value)) return '0:00'
  const totalSeconds = Math.max(0, Math.floor(value))
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`
}

function widthOf(segment: SegmentDraft): number {
  return Math.max(2, ((segment.end - segment.start) / total.value) * 100)
}

function offsetOf(segment: SegmentDraft): number {
  return Math.max(0, (segment.start / total.value) * 100)
}
</script>

<template>
  <div class="segment-editor">
    <div class="seg-toolbar">
      <span class="seg-title">
        演唱分段
        <b>{{ segments.length }}</b>
      </span>
      <button class="tool-btn" type="button" @click="splitEvenly">
        <Icon name="sliders" :size="12" />
        平均分段
      </button>
      <button class="tool-btn" type="button" @click="addSegment">
        <Icon name="plus" :size="12" />
        添加
      </button>
    </div>

    <div class="timeline">
      <span
        v-for="(segment, index) in segments"
        :key="segment.id"
        class="timeline-block"
        :style="{
          left: `${offsetOf(segment)}%`,
          width: `${widthOf(segment)}%`,
          background: COLORS[index % COLORS.length],
        }"
        :title="`${formatSeconds(segment.start)} - ${formatSeconds(segment.end)}`"
      ></span>
    </div>

    <p v-if="!duration" class="seg-warn">
      <Icon name="alert" :size="12" />
      未能读取音频时长，请手动填写每段起止秒数。
    </p>

    <div v-for="(segment, index) in segments" :key="segment.id" class="seg-card">
      <div class="seg-head">
        <b>
          <i :style="{ background: COLORS[index % COLORS.length] }"></i>
          第 {{ index + 1 }} 段
        </b>
        <button
          class="seg-remove"
          type="button"
          :disabled="segments.length <= 1"
          aria-label="删除分段"
          @click="removeSegment(index)"
        >
          <Icon name="trash" :size="12" />
        </button>
      </div>

      <p v-if="segment.text" class="seg-lyric">{{ segment.text }}</p>

      <div class="seg-times">
        <label>
          <span>开始</span>
          <input
            class="time-input mono"
            type="number"
            min="0"
            step="0.1"
            :value="segment.start"
            @change="onTimeChange(index, 'start', $event)"
          />
        </label>
        <span class="time-dash">—</span>
        <label>
          <span>结束</span>
          <input
            class="time-input mono"
            type="number"
            min="0"
            step="0.1"
            :value="segment.end"
            @change="onTimeChange(index, 'end', $event)"
          />
        </label>
        <span class="time-total mono">{{ formatSeconds(segment.end - segment.start) }}</span>
      </div>

      <div class="seg-models">
        <button
          v-for="model in models"
          :key="model.id"
          class="seg-model"
          :class="{ on: segment.modelIds.includes(model.id) }"
          type="button"
          @click="toggleModel(index, model.id)"
        >
          {{ model.name }}
        </button>
      </div>
    </div>

    <p v-if="issue" class="seg-issue">
      <Icon name="info" :size="12" />
      {{ issue }}
    </p>
    <p v-else class="seg-hint">
      <Icon name="info" :size="12" />
      同一段选择多个模型会生成合唱；分段可以留白，留白区间不演唱。
    </p>
  </div>
</template>

<style scoped>
.segment-editor {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 10px;
  border-top: 1px dashed var(--xb-border);
}

.seg-toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
}

.seg-title {
  flex: 1 1 auto;
  font-size: 11px;
  font-weight: 800;
}

.seg-title b {
  margin-left: 4px;
  padding: 1px 5px;
  border-radius: 999px;
  background: rgba(var(--xb-primary-rgb), 0.12);
  color: var(--xb-primary);
  font-size: 9px;
}

.tool-btn {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  height: 28px;
  padding: 0 8px;
  border: 1px solid var(--xb-border);
  border-radius: 8px;
  color: var(--xb-muted);
  font-size: 9px;
  font-weight: 700;
}

.tool-btn:active {
  color: var(--xb-primary);
  border-color: var(--xb-border-strong);
}

.timeline {
  position: relative;
  height: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(var(--xb-fill-rgb), 0.08);
}

.timeline-block {
  position: absolute;
  top: 0;
  bottom: 0;
  min-width: 3px;
  opacity: 0.85;
  border-right: 1px solid rgba(0, 0, 0, 0.25);
}

.seg-warn,
.seg-issue,
.seg-hint {
  display: flex;
  align-items: flex-start;
  gap: 5px;
  color: var(--xb-muted);
  font-size: 8.5px;
  line-height: 1.5;
}

.seg-warn,
.seg-issue {
  color: var(--xb-warn);
}

.seg-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  border: 1px solid var(--xb-border);
  border-radius: 10px;
  background: rgba(var(--xb-fill-rgb), 0.025);
}

.seg-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--xb-text);
  font-size: 10px;
}

.seg-head b {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-weight: 800;
}

.seg-head i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.seg-remove {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: 7px;
  color: var(--xb-muted);
}

.seg-remove:disabled {
  opacity: 0.3;
}

.seg-lyric {
  padding: 5px 7px;
  border-left: 2px solid rgba(var(--xb-primary-rgb), 0.45);
  border-radius: 0 6px 6px 0;
  background: rgba(var(--xb-primary-rgb), 0.045);
  color: var(--xb-text);
  font-size: 9.5px;
  line-height: 1.5;
}

.seg-times {
  display: flex;
  align-items: flex-end;
  gap: 6px;
}

.seg-times label {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1 1 0;
  min-width: 0;
}

.seg-times label span {
  color: var(--xb-muted);
  font-size: 8px;
}

.time-input {
  width: 100%;
  min-height: 30px;
  padding: 4px 6px;
  border: 1px solid var(--xb-border);
  border-radius: 7px;
  outline: none;
  background: rgba(var(--xb-bg-rgb), 0.55);
  color: var(--xb-text);
  font-size: 11px;
}

.time-input:focus {
  border-color: var(--xb-primary);
}

.time-dash {
  padding-bottom: 8px;
  color: var(--xb-muted);
  font-size: 10px;
}

.time-total {
  flex: none;
  padding-bottom: 7px;
  color: var(--xb-primary);
  font-size: 9px;
}

.seg-models {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.seg-model {
  height: 25px;
  padding: 0 8px;
  border: 1px solid var(--xb-border);
  border-radius: 999px;
  color: var(--xb-muted);
  font-size: 9px;
  font-weight: 700;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.seg-model.on {
  border-color: rgba(var(--xb-primary-rgb), 0.55);
  background: rgba(var(--xb-primary-rgb), 0.1);
  color: var(--xb-primary);
}
</style>
