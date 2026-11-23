<script setup lang="ts">
import { computed, ref } from 'vue'

import Icon from '@/components/Icon.vue'
import type { PymssModel } from '@/api/types'
import { formatBytes, stemLabel } from '@/utils/format'

const props = defineProps<{
  modelValue: string
  models: PymssModel[]
}>()

const emit = defineEmits<{
  (event: 'update:modelValue', value: string): void
}>()

const keyword = ref('')

const filtered = computed(() => {
  const text = keyword.value.trim().toLowerCase()
  if (!text) return props.models
  return props.models.filter((item) =>
    `${item.name} ${item.category_label || ''} ${item.purpose_label || ''}`
      .toLowerCase()
      .includes(text),
  )
})

function displayName(name: string): string {
  return name.replace(/\.(ckpt|pth|th|onnx)$/i, '')
}

function stems(item: PymssModel): string {
  const values = item.target_stems?.length ? item.target_stems : item.stems || []
  const labels = values
    .map((value) => stemLabel(value))
    .filter(Boolean)
  if (labels.length) return [...new Set(labels)].join(' + ')
  return item.category_label || item.purpose_label || '人声 / 伴奏'
}

function select(item: PymssModel): void {
  emit('update:modelValue', item.name)
}
</script>

<template>
  <div class="pymss-picker">
    <div class="picker-head">
      <div>
        <b>适配翻唱的人声分离模型</b>
        <span>来自电脑端，仅显示已下载且用途为人声分离的模型</span>
      </div>
      <span class="count">{{ models.length }}</span>
    </div>

    <div v-if="models.length > 4" class="picker-search">
      <Icon name="search" :size="14" />
      <input v-model="keyword" type="search" placeholder="搜索分离模型" />
    </div>

    <div v-if="filtered.length" class="picker-list">
      <button
        v-for="item in filtered"
        :key="item.name"
        class="pymss-row"
        :class="{ on: item.name === modelValue }"
        type="button"
        @click="select(item)"
      >
        <span class="radio"><span></span></span>
        <span class="row-main">
          <span class="row-title">
            <b class="truncate">{{ displayName(item.name) }}</b>
            <span class="tag">{{ item.category_label || item.purpose_label || '人声分离' }}</span>
          </span>
          <span class="row-meta">
            {{ stems(item) }}
            <template v-if="item.size_bytes"> · {{ formatBytes(item.size_bytes) }}</template>
          </span>
        </span>
        <Icon v-if="item.name === modelValue" name="check" :size="14" :stroke-width="3" class="check" />
      </button>
    </div>

    <div v-else class="picker-empty">
      <Icon name="alert" :size="18" />
      <div>
        <b>{{ models.length ? '没有匹配的模型' : '没有适配翻唱的 PyMSS 模型' }}</b>
        <p>
          {{
            models.length
              ? '换个关键词再试。'
              : '已下载的多轨、单乐器、卡拉 OK 或人声/伴奏双向模型不会出现在这里；请到模型页下载「人声分离」用途的模型，或先使用 UVR。'
          }}
        </p>
      </div>
    </div>

    <p class="picker-note">
      只列出电脑端标记为「人声分离」且已下载的模型；多轨、单乐器、KTV 与语音分离模型会被排除。
    </p>
  </div>
</template>

<style scoped>
.pymss-picker {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.picker-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.picker-head > div {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.picker-head b {
  font-size: 10.5px;
}

.picker-head span {
  color: var(--xb-muted);
  font-size: 8.5px;
  line-height: 1.45;
}

.count {
  flex: none;
  padding: 1px 7px;
  border-radius: 999px;
  background: rgba(var(--xb-primary-rgb), 0.1);
  color: var(--xb-primary) !important;
  font-size: 9px !important;
  font-weight: 800;
}

.picker-search {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 34px;
  padding: 0 9px;
  border: 1px solid var(--xb-border);
  border-radius: 9px;
  background: rgba(var(--xb-bg-rgb), 0.45);
  color: var(--xb-muted);
}

.picker-search input {
  flex: 1 1 auto;
  min-width: 0;
  border: 0;
  outline: none;
  background: transparent;
  color: var(--xb-text);
  font-size: 10.5px;
}

.picker-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
  max-height: 268px;
  overflow-y: auto;
  padding-right: 2px;
}

.pymss-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 9px;
  border: 1px solid var(--xb-border);
  border-radius: 11px;
  background: rgba(var(--xb-fill-rgb), 0.025);
  text-align: left;
}

.pymss-row.on {
  border-color: rgba(var(--xb-primary-rgb), 0.55);
  background: rgba(var(--xb-primary-rgb), 0.08);
}

.radio {
  display: grid;
  place-items: center;
  flex: none;
  width: 16px;
  height: 16px;
  border: 1.5px solid var(--xb-border-strong);
  border-radius: 50%;
}

.pymss-row.on .radio {
  border-color: var(--xb-primary);
}

.radio span {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: transparent;
}

.pymss-row.on .radio span {
  background: var(--xb-primary);
}

.row-main {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
  flex: 1 1 auto;
}

.row-title {
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
}

.row-title b {
  font-size: 10.5px;
  font-weight: 800;
}

.tag {
  flex: none;
  padding: 1px 5px;
  border-radius: 4px;
  background: rgba(var(--xb-primary-rgb), 0.09);
  color: var(--xb-primary);
  font-size: 7.5px;
  white-space: nowrap;
}

.row-meta {
  color: var(--xb-muted);
  font-size: 8.5px;
}

.check {
  flex: none;
  color: var(--xb-primary);
}

.picker-empty {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px;
  border: 1px dashed rgba(var(--xb-warn-rgb), 0.35);
  border-radius: 10px;
  color: var(--xb-warn);
}

.picker-empty b {
  font-size: 10px;
}

.picker-empty p {
  margin-top: 2px;
  color: var(--xb-muted);
  font-size: 8.5px;
  line-height: 1.5;
}

.picker-note {
  color: var(--xb-muted);
  font-size: 8px;
  line-height: 1.5;
  opacity: 0.8;
}
</style>
