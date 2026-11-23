<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'

import Icon from '@/components/Icon.vue'
import type { Job, JobStem } from '@/api/types'
import { bridge } from '@/api/bridge'
import { t } from '@/i18n'
import { useConfigStore } from '@/stores/config'
import { useDownloadsStore } from '@/stores/downloads'
import { useTasksStore } from '@/stores/tasks'
import { useUiStore } from '@/stores/ui'
import {
  formatDateTime,
  formatFramework,
  jobStatusLabel,
  stemLabel,
  stepLabel,
} from '@/utils/format'

const config = useConfigStore()
const tasks = useTasksStore()
const downloads = useDownloadsStore()
const ui = useUiStore()

const job = computed<Job | undefined>(() => tasks.getById(ui.activeTaskId))
const isDone = computed(() => job.value?.status === 'done')
const activeStep = computed(() => {
  const step = job.value?.steps?.find((item) => item.status === 'active')
  return step ? stepLabel(step.label) : t('tasks.preparing')
})

const audioEl = ref<HTMLAudioElement | null>(null)
const audioSrc = ref('')
const audioLoading = ref(false)
const audioPct = ref(0)
const audioError = ref('')
const playing = ref(false)
const currentTime = ref(0)
const duration = ref(0)
const seekProgress = computed(() => (duration.value ? (currentTime.value / duration.value) * 100 : 0))

const downloading = ref<JobStem | null>(null)
const STEMS: { key: JobStem; label: string; desc: string }[] = [
  { key: 'output', label: '成品', desc: '人声与伴奏混音后的成品' },
  { key: 'instrumental', label: '伴奏', desc: '分离得到的纯伴奏' },
  { key: 'vocals', label: '人声', desc: '模型转换后的干声' },
]

const workflowLabel = computed(() => {
  switch (job.value?.workflow) {
    case 'auto_mix':
      return '自动混音'
    case 'auto_then_editor':
      return '自动 + 编辑器'
    case 'full_manual_editor':
      return '全手动编辑'
    default:
      return job.value?.workflow || '—'
  }
})

const preprocessLabel = computed(() => {
  const preprocess = job.value?.preprocess
  if (!preprocess || !preprocess.enabled) return '未启用'
  const engine = preprocess.engine === 'pymss' ? 'PyMSS' : 'UVR'
  return preprocess.harmony_removal_enabled ? `${engine} + 去混响` : engine
})

watch(
  () => job.value?.id,
  () => {
    resetAudio()
    if (ui.taskAutoplay && job.value?.status === 'done') void loadAudio(true)
  },
  { immediate: true },
)

watch(
  () => job.value?.status,
  (status) => {
    if (status !== 'done') resetAudio()
  },
)

function resetAudio(): void {
  audioEl.value?.pause()
  playing.value = false
  currentTime.value = 0
  duration.value = 0
  audioSrc.value = ''
  audioError.value = ''
  audioPct.value = 0
}

async function loadAudio(autoplay = false): Promise<void> {
  if (!job.value) return
  if (audioSrc.value) {
    if (autoplay) await play()
    return
  }
  audioLoading.value = true
  audioError.value = ''
  audioPct.value = 0
  try {
    const path = await downloads.ensureAudio(job.value, 'output', (pct) => {
      audioPct.value = Math.round(pct)
    })
    audioSrc.value = path
    await nextTick()
    if (autoplay) await play()
  } catch (error) {
    audioError.value = error instanceof Error ? error.message : '音频读取失败'
  } finally {
    audioLoading.value = false
  }
}

async function play(): Promise<void> {
  const element = audioEl.value
  if (!element) return
  try {
    await element.play()
    playing.value = true
  } catch {
    playing.value = false
    audioError.value = '无法开始播放，请重试'
  }
}

async function togglePlay(): Promise<void> {
  if (!job.value) return
  if (!audioSrc.value) {
    await loadAudio(true)
    return
  }
  ui.haptic(8)
  if (playing.value) {
    audioEl.value?.pause()
    playing.value = false
  } else {
    await play()
  }
}

function onTimeUpdate(): void {
  currentTime.value = audioEl.value?.currentTime || 0
  duration.value = audioEl.value?.duration || duration.value
}

function onSeek(event: Event): void {
  const value = Number((event.target as HTMLInputElement).value)
  if (audioEl.value) audioEl.value.currentTime = value
  currentTime.value = value
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const total = Math.floor(seconds)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

async function downloadStem(stem: JobStem): Promise<void> {
  if (!job.value || downloading.value) return
  downloading.value = stem
  try {
    await downloads.startDownload(job.value, stem, config.downloadSubdir)
    ui.toast(`已开始下载${stemLabel(stem)}，保存到「下载/${config.downloadSubdir}」`, 'success')
  } catch (error) {
    ui.toast(error instanceof Error ? error.message : '下载失败', 'error')
  } finally {
    downloading.value = null
  }
}

async function rename(): Promise<void> {
  if (!job.value) return
  const title = await ui.prompt({
    title: '重命名作品',
    message: '只修改作品标题，不会影响已生成的文件。',
    value: job.value.title,
    placeholder: '输入新的作品标题',
    maxLength: 120,
  })
  if (!title || !job.value) return
  try {
    await tasks.rename(job.value.id, title)
    ui.toast('标题已更新', 'success')
  } catch (error) {
    ui.toast(error instanceof Error ? error.message : '重命名失败', 'error')
  }
}

async function retry(): Promise<void> {
  if (!job.value) return
  try {
    await tasks.retry(job.value.id)
    ui.toast('已重新加入推理队列', 'success')
  } catch (error) {
    ui.toast(error instanceof Error ? error.message : '重试失败', 'error')
  }
}

async function remove(): Promise<void> {
  if (!job.value) return
  const title = job.value.title
  const ok = await ui.confirm({
    title: '删除这个翻唱任务？',
    message: `「${title}」的任务记录与电脑端生成文件都会被删除，操作无法撤销。`,
    confirmText: '删除',
    danger: true,
  })
  if (!ok || !job.value) return
  const id = job.value.id
  try {
    await tasks.remove(id)
    downloads.forgetAudio(id)
    ui.closeTask()
    ui.toast('任务已删除', 'success')
  } catch (error) {
    ui.toast(error instanceof Error ? error.message : '删除失败', 'error')
  }
}

function close(): void {
  ui.closeTask()
}

function openDownloadsFolder(): void {
  void ui.haptic(8)
  void bridge.openDownloads()
}
</script>

<template>
  <Teleport to="body">
    <Transition name="sheet" appear>
      <div v-if="job" class="sheet-layer" @click.self="close">
        <section class="sheet">
          <div class="sheet-grab" @click="close"></div>

          <header class="sheet-head">
            <div class="head-main">
              <span class="badge" :class="`badge--${job.status}`">
                <span class="dot" :class="{ 'dot--pulse': job.status === 'running' || job.status === 'queue' }"></span>
                {{ jobStatusLabel(job.status) }}
              </span>
              <h2>{{ job.title }}</h2>
              <p class="head-sub">
                {{ job.model }} · {{ formatFramework(job.framework) }} ·
                {{ formatDateTime(job.created_at) }}
              </p>
            </div>
            <button class="icon-btn close-btn" type="button" aria-label="关闭" @click="close">
              <Icon name="close" :size="17" />
            </button>
          </header>

          <div class="sheet-body scroll-area">
            <div v-if="job.status === 'running' || job.status === 'queue'" class="live-card">
              <div class="live-head">
                <span class="live-label">
                  <span class="dot dot--pulse"></span>
                  {{ activeStep }}
                </span>
                <b class="mono live-pct">{{ Math.round(job.progress) }}%</b>
              </div>
              <div class="live-track">
                <i :style="{ width: `${job.progress}%` }"></i>
              </div>
              <p class="live-hint">
                {{
                  job.status === 'queue'
                    ? `排队位置 ${job.queue_position ?? '—'}，电脑端会按顺序执行`
                    : '推理正在电脑端执行，完成后即可试听与下载'
                }}
              </p>
            </div>

            <div v-if="job.status === 'failed'" class="fail-card">
              <Icon name="alert" :size="16" />
              <div>
                <b>任务执行失败</b>
                <p>{{ job.error || '电脑端返回了失败状态，可尝试重试。' }}</p>
              </div>
            </div>

            <section v-if="isDone" class="player-card glass">
              <div class="player-top">
                <div class="cover">
                  <Icon name="headphones" :size="22" />
                  <span class="cover-ring"></span>
                </div>
                <div class="player-info">
                  <p class="kicker">// PREVIEW</p>
                  <b>{{ job.title }}</b>
                  <span>{{ job.duration || '—' }} · {{ job.size || '—' }} · {{ job.format || 'WAV' }}</span>
                </div>
                <button class="download-folder" type="button" @click="openDownloadsFolder">
                  <Icon name="folder" :size="15" />
                </button>
              </div>

              <div class="player-controls">
                <button class="play-btn" type="button" :disabled="audioLoading" @click="togglePlay">
                  <span v-if="audioLoading" class="spinner dark"></span>
                  <Icon v-else :name="playing ? 'pause' : 'play'" :size="20" />
                </button>
                <div class="seek-wrap">
                  <input
                    class="seek"
                    type="range"
                    min="0"
                    :max="duration || 0"
                    step="0.1"
                    :value="currentTime"
                    :style="{ '--seek-progress': `${seekProgress}%` }"
                    @input="onSeek"
                  />
                  <div class="time-row mono">
                    <span>{{ formatTime(currentTime) }}</span>
                    <span>{{ formatTime(duration) }}</span>
                  </div>
                </div>
              </div>

              <div v-if="audioLoading" class="audio-note">
                <span>正在从电脑端读取音频 {{ audioPct }}%</span>
                <div class="audio-track"><i :style="{ width: `${audioPct}%` }"></i></div>
              </div>
              <p v-else-if="audioError" class="audio-error">{{ audioError }}</p>
              <audio
                ref="audioEl"
                :src="audioSrc || undefined"
                preload="metadata"
                @timeupdate="onTimeUpdate"
                @loadedmetadata="onTimeUpdate"
                @play="playing = true"
                @pause="playing = false"
                @ended="playing = false"
              ></audio>
            </section>

            <section class="meta-grid glass">
              <div class="meta-item">
                <span>使用模型</span>
                <b>{{ job.model }}</b>
              </div>
              <div class="meta-item">
                <span>推理框架</span>
                <b>{{ formatFramework(job.framework) }}</b>
              </div>
              <div class="meta-item">
                <span>前期处理</span>
                <b>{{ preprocessLabel }}</b>
              </div>
              <div class="meta-item">
                <span>生成流程</span>
                <b>{{ workflowLabel }}</b>
              </div>
              <div class="meta-item">
                <span>AI 美声</span>
                <b>{{ job.vocal_enhancement?.enabled ? `已开启 · ${job.vocal_enhancement.level === 'advanced' ? '进阶' : '基础'}` : '未开启' }}</b>
              </div>
              <div class="meta-item">
                <span>任务 ID</span>
                <b class="mono id-value">{{ job.id }}</b>
              </div>
            </section>

            <section v-if="job.steps?.length" class="steps-card glass">
              <div class="block-head">
                <span class="block-title">处理流程</span>
                <span class="block-note">{{ job.steps.filter((step) => step.status === 'done').length }}/{{ job.steps.length }}</span>
              </div>
              <ol class="steps">
                <li
                  v-for="step in job.steps"
                  :key="step.key"
                  class="step"
                  :class="`step--${step.status}`"
                >
                  <span class="step-dot">
                    <Icon v-if="step.status === 'done'" name="check" :size="9" :stroke-width="3" />
                    <span v-else-if="step.status === 'active'" class="step-spin"></span>
                    <span v-else-if="step.status === 'failed'" class="step-fail"></span>
                  </span>
                  <span class="step-label">{{ stepLabel(step.label) }}</span>
                </li>
              </ol>
            </section>

            <section v-if="isDone" class="downloads-card glass">
              <div class="block-head">
                <span class="block-title">下载素材</span>
                <span class="block-note">保存到 下载/{{ config.downloadSubdir }}</span>
              </div>
              <div class="stem-list">
                <div v-for="stem in STEMS" :key="stem.key" class="stem-row">
                  <span class="stem-icon">
                    <Icon :name="stem.key === 'output' ? 'disc' : stem.key === 'instrumental' ? 'music' : 'mic'" :size="16" />
                  </span>
                  <div class="stem-text">
                    <b>{{ stemLabel(stem.key) }}</b>
                    <span>{{ stem.desc }}</span>
                  </div>
                  <button
                    class="stem-btn"
                    type="button"
                    :disabled="downloading !== null"
                    @click="downloadStem(stem.key)"
                  >
                    <span v-if="downloading === stem.key" class="spinner"></span>
                    <Icon v-else name="download" :size="14" />
                  </button>
                </div>
              </div>
            </section>

            <section class="actions-card">
              <button class="action" type="button" @click="rename">
                <Icon name="edit" :size="16" />
                重命名
              </button>
              <button
                v-if="job.status === 'failed'"
                class="action"
                type="button"
                @click="retry"
              >
                <Icon name="refresh" :size="16" />
                重试任务
              </button>
              <button class="action danger" type="button" @click="remove">
                <Icon name="trash" :size="16" />
                删除任务
              </button>
            </section>

            <p class="sheet-note">
              音频编辑、MIDI 与多模型时间轴编排请在电脑端「Audio Editor Lite」中继续。
            </p>
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.sheet-layer {
  position: fixed;
  inset: 0;
  z-index: 70;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgba(3, 5, 12, 0.62);
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
}

.sheet {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 560px;
  max-height: 92vh;
  max-height: 92dvh;
  border: 1px solid var(--xb-border);
  border-bottom: 0;
  border-radius: 24px 24px 0 0;
  background:
    radial-gradient(120% 45% at 50% 0%, rgba(var(--xb-primary-rgb), 0.1), transparent 62%),
    var(--xb-bg-2);
  box-shadow: 0 -20px 60px rgba(0, 0, 0, 0.55);
  overflow: hidden;
}

.sheet-grab {
  flex: none;
  width: 38px;
  height: 4px;
  margin: 8px auto 2px;
  border-radius: 999px;
  background: rgba(var(--xb-fill-rgb), 0.22);
}

.sheet-head {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  flex: none;
  padding: 8px 16px 12px;
  border-bottom: 1px solid var(--xb-border);
}

.head-main {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 5px;
  min-width: 0;
  flex: 1 1 auto;
}

.head-main h2 {
  font-size: 18px;
  font-weight: 800;
  letter-spacing: -0.4px;
  line-height: 1.3;
}

.head-sub {
  color: var(--xb-muted);
  font-size: 10px;
  line-height: 1.45;
}

.close-btn {
  flex: none;
  margin-top: 1px;
}

.sheet-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1 1 auto;
  min-height: 0;
  padding: 14px 16px calc(20px + env(safe-area-inset-bottom));
  overflow-y: auto;
}

.live-card {
  padding: 12px;
  border: 1px solid rgba(var(--xb-primary-rgb), 0.28);
  border-radius: 14px;
  background: rgba(var(--xb-primary-rgb), 0.06);
}

.live-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.live-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--xb-primary);
  font-size: 11px;
  font-weight: 700;
}

.live-pct {
  color: var(--xb-text);
  font-size: 15px;
  font-weight: 800;
}

.live-track {
  height: 5px;
  margin-top: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(var(--xb-fill-rgb), 0.1);
}

.live-track i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--xb-brand-gradient);
  transition: width 0.5s ease;
}

.live-hint {
  margin-top: 7px;
  color: var(--xb-muted);
  font-size: 10px;
  line-height: 1.5;
}

.fail-card {
  display: flex;
  gap: 9px;
  padding: 11px;
  border: 1px solid rgba(var(--xb-danger-rgb), 0.3);
  border-radius: 13px;
  background: rgba(var(--xb-danger-rgb), 0.07);
  color: var(--xb-danger);
}

.fail-card b {
  font-size: 12px;
}

.fail-card p {
  margin-top: 2px;
  color: var(--xb-muted);
  font-size: 10.5px;
  line-height: 1.55;
}

.player-card {
  padding: 12px;
  border-radius: 16px;
}

.player-top {
  display: flex;
  align-items: center;
  gap: 10px;
}

.cover {
  position: relative;
  display: grid;
  place-items: center;
  flex: none;
  width: 46px;
  height: 46px;
  border-radius: 14px;
  background: var(--xb-brand-gradient);
  color: var(--xb-on-primary);
  box-shadow: 0 6px 18px rgba(var(--xb-primary-rgb), 0.3);
}

.cover-ring {
  position: absolute;
  inset: 3px;
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-radius: 11px;
}

.player-info {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
  flex: 1 1 auto;
}

.player-info b {
  font-size: 13px;
  font-weight: 800;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.player-info span {
  color: var(--xb-muted);
  font-size: 9.5px;
  font-variant-numeric: tabular-nums;
}

.download-folder {
  display: grid;
  place-items: center;
  flex: none;
  width: 32px;
  height: 32px;
  border: 1px solid var(--xb-border);
  border-radius: 10px;
  color: var(--xb-muted);
}

.download-folder:active {
  color: var(--xb-primary);
  border-color: var(--xb-border-strong);
}

.player-controls {
  display: flex;
  align-items: center;
  gap: 11px;
  margin-top: 12px;
}

.play-btn {
  display: grid;
  place-items: center;
  flex: none;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--xb-brand-gradient);
  color: var(--xb-on-primary);
  box-shadow: 0 6px 20px rgba(var(--xb-primary-rgb), 0.32);
}

.play-btn:active {
  transform: scale(0.94);
}

.play-btn .spinner.dark {
  border-color: rgba(0, 0, 0, 0.2);
  border-top-color: var(--xb-on-primary);
}

.seek-wrap {
  flex: 1 1 auto;
  min-width: 0;
}

.seek {
  width: 100%;
  height: 18px;
  margin: 0;
  appearance: none;
  -webkit-appearance: none;
  background: transparent;
}

.seek::-webkit-slider-runnable-track {
  height: 4px;
  border-radius: 999px;
  background: linear-gradient(
    90deg,
    var(--xb-primary) 0%,
    var(--xb-primary-2) var(--seek-progress),
    rgba(var(--xb-fill-rgb), 0.14) var(--seek-progress),
    rgba(var(--xb-fill-rgb), 0.14) 100%
  );
}

.seek::-webkit-slider-thumb {
  width: 13px;
  height: 13px;
  margin-top: -4.5px;
  appearance: none;
  -webkit-appearance: none;
  border: 2px solid var(--xb-bg-2);
  border-radius: 50%;
  background: var(--xb-primary);
  box-shadow: 0 0 10px rgba(var(--xb-primary-rgb), 0.6);
}

.time-row {
  display: flex;
  justify-content: space-between;
  color: var(--xb-muted);
  font-size: 9px;
}

.audio-note {
  margin-top: 8px;
  color: var(--xb-primary);
  font-size: 9.5px;
}

.audio-track {
  height: 3px;
  margin-top: 5px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(var(--xb-fill-rgb), 0.1);
}

.audio-track i {
  display: block;
  height: 100%;
  background: var(--xb-primary);
  transition: width 0.3s ease;
}

.audio-error {
  margin-top: 7px;
  color: var(--xb-danger);
  font-size: 10px;
}

.meta-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px 10px;
  padding: 13px;
  border-radius: 15px;
}

.meta-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.meta-item span {
  color: var(--xb-muted);
  font-size: 9px;
  letter-spacing: 0.3px;
}

.meta-item b {
  font-size: 11.5px;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.meta-item .id-value {
  font-size: 9.5px;
  color: var(--xb-muted);
}

.steps-card,
.downloads-card {
  padding: 13px;
  border-radius: 15px;
}

.block-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}

.block-title {
  font-size: 12px;
  font-weight: 800;
}

.block-note {
  color: var(--xb-muted);
  font-size: 9px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.steps {
  display: flex;
  flex-wrap: wrap;
  gap: 7px 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.step {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--xb-muted);
  font-size: 9.5px;
  white-space: nowrap;
}

.step-dot {
  display: grid;
  place-items: center;
  width: 14px;
  height: 14px;
  border: 1px solid currentColor;
  border-radius: 50%;
  opacity: 0.8;
}

.step--done {
  color: var(--xb-success);
}

.step--done .step-dot {
  border-color: currentColor;
  background: rgba(var(--xb-success-rgb), 0.16);
}

.step--active {
  color: var(--xb-primary);
  font-weight: 700;
}

.step--failed {
  color: var(--xb-danger);
}

.step-spin {
  width: 7px;
  height: 7px;
  border: 1.5px solid rgba(var(--xb-primary-rgb), 0.3);
  border-top-color: var(--xb-primary);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

.step-fail {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--xb-danger);
}

.stem-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.stem-row {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 8px;
  border: 1px solid var(--xb-border);
  border-radius: 11px;
  background: rgba(var(--xb-fill-rgb), 0.02);
}

.stem-icon {
  display: grid;
  place-items: center;
  flex: none;
  width: 30px;
  height: 30px;
  border-radius: 9px;
  background: rgba(var(--xb-primary-rgb), 0.1);
  color: var(--xb-primary);
}

.stem-text {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
  flex: 1 1 auto;
}

.stem-text b {
  font-size: 11.5px;
}

.stem-text span {
  color: var(--xb-muted);
  font-size: 9px;
}

.stem-btn {
  display: grid;
  place-items: center;
  flex: none;
  width: 34px;
  height: 34px;
  border: 1px solid rgba(var(--xb-primary-rgb), 0.3);
  border-radius: 10px;
  background: rgba(var(--xb-primary-rgb), 0.08);
  color: var(--xb-primary);
}

.stem-btn:active:not(:disabled) {
  transform: scale(0.94);
}

.stem-btn .spinner {
  width: 14px;
  height: 14px;
  border-width: 2px;
}

.actions-card {
  display: flex;
  gap: 7px;
}

.action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  flex: 1 1 0;
  min-height: 40px;
  border: 1px solid var(--xb-border);
  border-radius: 11px;
  background: rgba(var(--xb-fill-rgb), 0.03);
  color: var(--xb-text);
  font-size: 11px;
  font-weight: 700;
}

.action.danger {
  color: var(--xb-danger);
  border-color: rgba(var(--xb-danger-rgb), 0.3);
  background: rgba(var(--xb-danger-rgb), 0.07);
}

.action:active {
  transform: scale(0.97);
}

.sheet-note {
  padding: 0 4px;
  color: var(--xb-muted);
  font-size: 9.5px;
  line-height: 1.6;
  text-align: center;
  opacity: 0.8;
}

.sheet-enter-active,
.sheet-leave-active {
  transition: opacity 0.22s ease;
}

.sheet-enter-active .sheet,
.sheet-leave-active .sheet {
  transition: transform 0.26s cubic-bezier(0.22, 1, 0.36, 1);
}

.sheet-enter-from,
.sheet-leave-to {
  opacity: 0;
}

.sheet-enter-from .sheet,
.sheet-leave-to .sheet {
  transform: translateY(100%);
}
</style>
