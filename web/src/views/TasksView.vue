<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

import Icon from '@/components/Icon.vue'
import TaskCard from '@/components/TaskCard.vue'
import { t } from '@/i18n'
import type { Job } from '@/api/types'
import { useConfigStore } from '@/stores/config'
import { useDownloadsStore } from '@/stores/downloads'
import { useTasksStore } from '@/stores/tasks'
import { useUiStore } from '@/stores/ui'
import { formatDateTime, stepLabel } from '@/utils/format'

type FilterKey = 'all' | 'active' | 'done' | 'failed'

const config = useConfigStore()
const tasks = useTasksStore()
const downloads = useDownloadsStore()
const ui = useUiStore()

const filter = ref<FilterKey>('all')
const keyword = ref('')
const downloading = ref<string | null>(null)
const visibleCount = ref(30)

const FILTERS: { key: FilterKey; labelKey: string }[] = [
  { key: 'all', labelKey: 'tasks.all' },
  { key: 'active', labelKey: 'tasks.active' },
  { key: 'done', labelKey: 'tasks.done' },
  { key: 'failed', labelKey: 'tasks.failed' },
]

const counts = computed(() => tasks.counts)

const filtered = computed(() => {
  const text = keyword.value.trim().toLowerCase()
  return tasks.jobs.filter((job) => {
    if (filter.value === 'active' && job.status !== 'running' && job.status !== 'queue') return false
    if (filter.value === 'done' && job.status !== 'done') return false
    if (filter.value === 'failed' && job.status !== 'failed') return false
    if (!text) return true
    return (
      job.title.toLowerCase().includes(text) ||
      job.model.toLowerCase().includes(text) ||
      job.id.toLowerCase().includes(text)
    )
  })
})

const runningJob = computed(() => tasks.runningJob)
const activeStepLabel = computed(() => {
  const step = tasks.runningJob?.steps?.find((item) => item.status === 'active')
  return step ? stepLabel(step.label) : t('job.running')
})
const visibleJobs = computed(() => filtered.value.slice(0, visibleCount.value))
const hasMore = computed(() => filtered.value.length > visibleCount.value)
const queuePending = computed(() => tasks.queue?.size ?? 0)
const syncedAt = computed(() =>
  tasks.lastSynced ? formatDateTime(new Date(tasks.lastSynced).toISOString()) : '—',
)

const filterCount = computed<Record<FilterKey, number>>(() => ({
  all: counts.value.total,
  active: counts.value.active,
  done: counts.value.done,
  failed: counts.value.failed,
}))

function goCreate(): void {
  window.location.hash = '#/create'
}

async function refresh(): Promise<void> {
  ui.haptic()
  await tasks.load(true)
}

function openJob(job: Job): void {
  ui.openTask(job.id)
}

async function playJob(job: Job): Promise<void> {
  ui.openTask(job.id, true)
}

async function downloadJob(job: Job): Promise<void> {
  if (downloading.value) return
  downloading.value = job.id
  try {
    await downloads.startDownload(job, 'output', config.downloadSubdir)
    ui.toast('已开始下载成品，可在系统通知中查看进度', 'success')
  } catch (error) {
    ui.toast(error instanceof Error ? error.message : '下载失败', 'error')
  } finally {
    downloading.value = null
  }
}

async function retryJob(job: Job): Promise<void> {
  try {
    await tasks.retry(job.id)
    ui.toast('已重新加入推理队列', 'success')
  } catch (error) {
    ui.toast(error instanceof Error ? error.message : '重试失败', 'error')
  }
}

onMounted(() => {
  if (!tasks.jobs.length) void tasks.load()
})

watch([filter, keyword], () => {
  visibleCount.value = 30
})
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <p class="kicker">{{ t('tasks.kicker') }}</p>
        <h1 class="page-title">{{ t('tasks.title') }}<span class="grad-text">{{ t('tasks.titleAccent') }}</span></h1>
        <p class="page-sub">{{ t('tasks.sub') }}</p>
      </div>
      <button class="icon-btn refresh" type="button" :class="{ spinning: tasks.refreshing }" @click="refresh">
        <Icon name="refresh" :size="18" />
      </button>
    </div>

    <div v-if="config.connectionError || tasks.error" class="offline-banner">
      <Icon name="alert" :size="15" />
      <div class="grow">
        <b>与电脑的连接已断开</b>
        <p>{{ config.connectionError || tasks.error }}</p>
      </div>
      <button class="btn btn--sm" type="button" @click="config.connect()">重连</button>
    </div>

    <section class="queue-card glass">
      <div class="queue-glow"></div>
      <div class="queue-head">
        <div>
          <p class="kicker">// QUEUE STATUS</p>
          <h2 v-if="runningJob" class="queue-title">{{ runningJob.title }}</h2>
          <h2 v-else class="queue-title">{{ t('tasks.queueEmpty') }}</h2>
          <p class="queue-sub">
            <template v-if="runningJob">
              {{ activeStepLabel }} ·
              {{ runningJob.model }}
            </template>
            <template v-else>{{ t('tasks.queueEmptySub') }}</template>
          </p>
        </div>
        <div v-if="runningJob" class="queue-percent mono">{{ Math.round(runningJob.progress) }}<span>%</span></div>
        <div v-else class="wave-bars deco">
          <i v-for="n in 7" :key="n" :style="{ animationDelay: `${n * 0.09}s` }"></i>
        </div>
      </div>

      <div v-if="runningJob" class="queue-progress">
        <i :style="{ width: `${runningJob.progress}%` }"></i>
      </div>

      <div class="queue-stats">
        <div class="stat">
          <b class="mono">{{ counts.total }}</b>
          <span>{{ t('tasks.statTotal') }}</span>
        </div>
        <div class="stat">
          <b class="mono accent">{{ counts.active }}</b>
          <span>{{ t('tasks.statActive') }}</span>
        </div>
        <div class="stat">
          <b class="mono success">{{ counts.done }}</b>
          <span>{{ t('tasks.statDone') }}</span>
        </div>
        <div class="stat">
          <b class="mono warn">{{ queuePending }}</b>
          <span>{{ t('tasks.statWait') }}</span>
        </div>
      </div>

      <button v-if="runningJob" class="queue-open" type="button" @click="openJob(runningJob)">
        {{ t('tasks.viewCurrent') }}
        <Icon name="chevron" :size="14" />
      </button>
    </section>

    <div class="toolbar">
      <div class="search">
        <Icon name="search" :size="15" />
        <input v-model="keyword" type="search" :placeholder="t('tasks.search')" />
        <button v-if="keyword" class="clear" type="button" @click="keyword = ''">
          <Icon name="close" :size="13" />
        </button>
      </div>
    </div>

    <div class="filters">
      <button
        v-for="item in FILTERS"
        :key="item.key"
        class="filter"
        :class="{ on: filter === item.key }"
        type="button"
        @click="filter = item.key"
      >
        {{ t(item.labelKey) }}
        <b>{{ filterCount[item.key] }}</b>
      </button>
    </div>

    <section v-if="tasks.loading" class="list">
      <div v-for="n in 3" :key="n" class="skeleton-card">
        <div class="skeleton" style="width: 42%; height: 15px"></div>
        <div class="skeleton" style="width: 68%; height: 10px"></div>
        <div class="skeleton" style="width: 100%; height: 5px"></div>
      </div>
    </section>

    <section v-else-if="visibleJobs.length" class="list">
      <TaskCard
        v-for="job in visibleJobs"
        :key="job.id"
        v-memo="[job.status, job.progress, job.title, job.model, job.error, job.queue_position]"
        :job="job"
        @open="openJob"
        @play="playJob"
        @download="downloadJob"
        @retry="retryJob"
      />
      <button v-if="hasMore" class="load-more" type="button" @click="visibleCount += 30">
        显示更多（{{ filtered.length - visibleJobs.length }}）
      </button>
    </section>

    <section v-else class="empty glass">
      <div class="empty-icon">
        <Icon :name="keyword || filter !== 'all' ? 'search' : 'headphones'" :size="26" />
      </div>
      <p class="empty-title">
        {{ keyword || filter !== 'all' ? '没有符合条件的任务' : t('tasks.emptyTitle') }}
      </p>
      <p class="empty-sub">
        {{
          keyword || filter !== 'all'
            ? '换个筛选条件或清空搜索词试试。'
            : t('tasks.emptySub')
        }}
      </p>
      <button
        v-if="!keyword && filter === 'all'"
        class="btn btn--primary"
        type="button"
        @click="goCreate"
      >
        <Icon name="plus" :size="15" />
        {{ t('tasks.createFirst') }}
      </button>
    </section>

    <footer class="sync-foot">
      <span class="sync-dot"></span>
      {{ t('tasks.sync', { time: syncedAt }) }}
    </footer>
  </div>
</template>

<style scoped>
.refresh.spinning :deep(svg) {
  animation: spin 0.9s linear infinite;
}

.offline-banner {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 10px 12px;
  border: 1px solid rgba(var(--xb-danger-rgb), 0.32);
  border-radius: 13px;
  background: rgba(var(--xb-danger-rgb), 0.08);
  color: var(--xb-danger);
}

.offline-banner b {
  font-size: 11.5px;
}

.offline-banner p {
  margin-top: 1px;
  color: var(--xb-muted);
  font-size: 10px;
  line-height: 1.4;
}

.queue-card {
  overflow: hidden;
  padding: 15px;
}

.queue-glow {
  position: absolute;
  top: -70px;
  right: -50px;
  width: 190px;
  height: 190px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(var(--xb-primary-rgb), 0.16), transparent 65%);
  pointer-events: none;
}

.queue-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.queue-title {
  margin-top: 6px;
  font-size: 17px;
  font-weight: 800;
  letter-spacing: -0.3px;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.queue-sub {
  margin-top: 4px;
  color: var(--xb-muted);
  font-size: 10.5px;
  line-height: 1.5;
}

.queue-percent {
  flex: none;
  color: var(--xb-primary);
  font-size: 30px;
  font-weight: 800;
  letter-spacing: -2px;
  line-height: 1;
  text-shadow: 0 0 22px rgba(var(--xb-primary-rgb), 0.5);
}

.queue-percent span {
  font-size: 13px;
  letter-spacing: 0;
  opacity: 0.7;
}

.deco {
  height: 40px;
  gap: 3px;
}

.deco i {
  width: 3px;
}

.queue-progress {
  height: 4px;
  margin-top: 12px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(var(--xb-fill-rgb), 0.08);
}

.queue-progress i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--xb-brand-gradient);
  box-shadow: 0 0 14px rgba(var(--xb-primary-rgb), 0.55);
  transition: width 0.6s ease;
}

.queue-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--xb-border);
}

.stat {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.stat b {
  font-size: 18px;
  font-weight: 800;
  line-height: 1.1;
}

.stat b.accent {
  color: var(--xb-primary);
}

.stat b.success {
  color: var(--xb-success);
}

.stat b.warn {
  color: var(--xb-warn);
}

.stat span {
  color: var(--xb-muted);
  font-size: 9px;
  letter-spacing: 0.2px;
  white-space: nowrap;
}

.queue-open {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
  width: 100%;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px dashed var(--xb-border);
  color: var(--xb-primary);
  font-size: 11px;
  font-weight: 700;
}

.toolbar {
  display: flex;
  gap: 8px;
  align-items: center;
}

.search {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  gap: 8px;
  height: 42px;
  padding: 0 12px;
  border: 1px solid var(--xb-border);
  border-radius: 13px;
  background: rgba(var(--xb-bg-rgb), 0.5);
  color: var(--xb-muted);
  transition: border-color 0.15s ease;
}

.search:focus-within {
  border-color: rgba(var(--xb-primary-rgb), 0.55);
}

.search input {
  flex: 1 1 auto;
  min-width: 0;
  border: 0;
  outline: none;
  background: transparent;
  color: var(--xb-text);
  font-size: 12.5px;
}

.search input::placeholder {
  color: var(--xb-muted);
  opacity: 0.8;
}

.search input::-webkit-search-cancel-button {
  display: none;
}

.clear {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: rgba(var(--xb-fill-rgb), 0.08);
  color: var(--xb-muted);
}

.filters {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding-bottom: 1px;
  scrollbar-width: none;
}

.filters::-webkit-scrollbar {
  display: none;
}

.filter {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  flex: none;
  height: 32px;
  padding: 0 11px;
  border: 1px solid var(--xb-border);
  border-radius: 999px;
  background: rgba(var(--xb-fill-rgb), 0.025);
  color: var(--xb-muted);
  font-size: 11px;
  font-weight: 700;
  transition: all 0.15s ease;
}

.filter b {
  padding: 0 4px;
  border-radius: 999px;
  background: rgba(var(--xb-fill-rgb), 0.08);
  font-size: 9px;
  font-weight: 800;
}

.filter.on {
  border-color: rgba(var(--xb-primary-rgb), 0.5);
  background: rgba(var(--xb-primary-rgb), 0.1);
  color: var(--xb-primary);
}

.filter.on b {
  background: rgba(var(--xb-primary-rgb), 0.18);
}

.list {
  display: flex;
  flex-direction: column;
  gap: 11px;
}

.list .load-more {
  align-self: center;
  margin-top: 2px;
  padding: 8px 16px;
  border: 1px solid var(--xb-border);
  border-radius: 999px;
  color: var(--xb-muted);
  font-size: 10px;
  font-weight: 700;
}

.skeleton-card {
  display: flex;
  flex-direction: column;
  gap: 9px;
  padding: 14px;
  border: 1px solid var(--xb-border);
  border-radius: 17px;
}

.empty {
  padding: 30px 18px 28px;
}

.sync-foot {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 6px 0 2px;
  color: var(--xb-muted);
  font-size: 9.5px;
  opacity: 0.75;
}

.sync-dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--xb-success);
  box-shadow: 0 0 6px var(--xb-success);
}
</style>
