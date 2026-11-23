<script setup lang="ts">
import { computed } from 'vue'

import Icon from '@/components/Icon.vue'
import { t } from '@/i18n'
import type { Job } from '@/api/types'
import { formatFramework, jobStatusLabel, relativeTime, stepLabel } from '@/utils/format'

const props = defineProps<{ job: Job }>()
const emit = defineEmits<{
  (event: 'open', job: Job): void
  (event: 'play', job: Job): void
  (event: 'download', job: Job): void
  (event: 'retry', job: Job): void
}>()

const activeStep = computed(() => {
  const step = props.job.steps?.find((item) => item.status === 'active')
  return step
    ? stepLabel(step.label)
    : props.job.status === 'queue'
      ? t('tasks.waitingQueue')
      : t('tasks.preparing')
})

const progress = computed(() => Math.max(0, Math.min(100, Math.round(props.job.progress || 0))))

const isDone = computed(() => props.job.status === 'done')
const isRunning = computed(() => props.job.status === 'running' || props.job.status === 'queue')
</script>

<template>
  <article
    class="task-card"
    :class="[`is-${job.status}`]"
    @click="emit('open', job)"
  >
    <div class="card-top">
      <div class="title-wrap">
        <span class="badge" :class="`badge--${job.status}`">
          <span class="dot" :class="{ 'dot--pulse': isRunning }"></span>
          {{ jobStatusLabel(job.status) }}
        </span>
        <h3 class="title">{{ job.title }}</h3>
        <p class="meta">
          <span class="model">{{ job.model }}</span>
          <span class="sep">·</span>
          <span>{{ formatFramework(job.framework) }}</span>
          <span class="sep">·</span>
          <span>{{ relativeTime(job.created_at) }}</span>
        </p>
      </div>
      <button class="more" type="button" aria-label="任务操作" @click.stop="emit('open', job)">
        <Icon name="more" :size="18" />
      </button>
    </div>

    <div v-if="isRunning" class="progress-block">
      <div class="progress-head">
        <span class="step-label">{{ activeStep }}</span>
        <span class="mono percent">{{ progress }}%</span>
      </div>
      <div class="progress-track">
        <i :style="{ width: `${progress}%` }"></i>
      </div>
    </div>

    <p v-else-if="job.status === 'failed'" class="error-line">
      <Icon name="alert" :size="13" />
      <span class="truncate">{{ job.error || '任务执行失败' }}</span>
    </p>

    <div v-else class="done-line">
      <span v-if="job.duration">{{ job.duration }}</span>
      <span v-if="job.size" class="sep">·</span>
      <span v-if="job.size">{{ job.size }}</span>
      <span v-if="job.format" class="sep">·</span>
      <span v-if="job.format">{{ job.format }}</span>
      <span class="done-flag">
        <Icon name="check" :size="11" :stroke-width="2.4" />
        {{ t('tasks.readyDownload') }}
      </span>
    </div>

    <div class="card-foot">
      <div class="foot-left">
        <button
          v-if="isDone"
          class="mini-btn"
          type="button"
          @click.stop="emit('play', job)"
        >
          <Icon name="play" :size="13" />
          {{ t('common.preview') }}
        </button>
        <button
          v-if="isDone"
          class="mini-btn accent"
          type="button"
          @click.stop="emit('download', job)"
        >
          <Icon name="download" :size="13" />
          {{ t('tasks.downloadFinal') }}
        </button>
        <button
          v-if="job.status === 'failed'"
          class="mini-btn accent"
          type="button"
          @click.stop="emit('retry', job)"
        >
          <Icon name="refresh" :size="13" />
          {{ t('common.retry') }}
        </button>
      </div>
      <span class="detail-link">
        {{ t('common.details') }}
        <Icon name="chevron" :size="13" />
      </span>
    </div>
  </article>
</template>

<style scoped>
.task-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 11px;
  padding: 14px;
  border: 1px solid var(--xb-border);
  border-radius: 17px;
  background: linear-gradient(155deg, var(--xb-glass-top), var(--xb-glass-bottom)), var(--xb-panel);
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.28);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  transition: transform 0.15s ease, border-color 0.15s ease;
  overflow: hidden;
}

.task-card:active {
  transform: scale(0.988);
}

.task-card.is-running::before,
.task-card.is-queue::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  width: 2px;
  background: var(--xb-brand-gradient);
  box-shadow: 0 0 14px rgba(var(--xb-primary-rgb), 0.5);
}

.task-card.is-failed {
  border-color: rgba(var(--xb-danger-rgb), 0.28);
}

.card-top {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.title-wrap {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  min-width: 0;
  flex: 1 1 auto;
}

.title {
  max-width: 100%;
  font-size: 15px;
  font-weight: 800;
  letter-spacing: -0.2px;
  line-height: 1.35;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.meta {
  display: flex;
  align-items: center;
  gap: 4px;
  max-width: 100%;
  color: var(--xb-muted);
  font-size: 10.5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.meta .model {
  max-width: 46%;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--xb-text);
  opacity: 0.72;
  font-weight: 600;
}

.sep {
  opacity: 0.45;
}

.more {
  display: grid;
  place-items: center;
  flex: none;
  width: 30px;
  height: 30px;
  margin: -4px -4px 0 0;
  border-radius: 9px;
  color: var(--xb-muted);
}

.more:active {
  background: rgba(var(--xb-primary-rgb), 0.08);
}

.progress-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.progress-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  font-size: 10.5px;
}

.step-label {
  color: var(--xb-primary);
  font-weight: 700;
}

.percent {
  color: var(--xb-text);
  font-size: 11px;
  font-weight: 700;
}

.progress-track {
  position: relative;
  height: 5px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(var(--xb-fill-rgb), 0.08);
}

.progress-track i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--xb-brand-gradient);
  box-shadow: 0 0 12px rgba(var(--xb-primary-rgb), 0.55);
  transition: width 0.5s ease;
}

.progress-track i::after {
  content: '';
  display: block;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.5), transparent);
  animation: scan 1.6s linear infinite;
}

.error-line {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 7px 9px;
  border-radius: 9px;
  background: rgba(var(--xb-danger-rgb), 0.08);
  color: var(--xb-danger);
  font-size: 10.5px;
}

.error-line span {
  min-width: 0;
}

.done-line {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--xb-muted);
  font-size: 10.5px;
  font-variant-numeric: tabular-nums;
}

.done-flag {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  margin-left: auto;
  color: var(--xb-success);
  font-size: 10px;
  font-weight: 700;
}

.card-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-top: 10px;
  border-top: 1px solid var(--xb-border);
}

.foot-left {
  display: flex;
  align-items: center;
  gap: 6px;
}

.mini-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-height: 30px;
  padding: 0 9px;
  border: 1px solid var(--xb-border);
  border-radius: 9px;
  background: rgba(var(--xb-fill-rgb), 0.03);
  color: var(--xb-muted);
  font-size: 10.5px;
  font-weight: 700;
}

.mini-btn.accent {
  border-color: rgba(var(--xb-primary-rgb), 0.34);
  background: rgba(var(--xb-primary-rgb), 0.09);
  color: var(--xb-primary);
}

.mini-btn:active {
  transform: scale(0.95);
}

.detail-link {
  display: inline-flex;
  align-items: center;
  gap: 1px;
  color: var(--xb-muted);
  font-size: 10.5px;
  font-weight: 700;
}

@keyframes scan {
  from {
    transform: translateX(-100%);
  }
  to {
    transform: translateX(100%);
  }
}
</style>
