<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import Icon from '@/components/Icon.vue'
import { t } from '@/i18n'
import type { HubModelItem, PymssModel, VoiceModel } from '@/api/types'
import { useModelsStore } from '@/stores/models'
import { useUiStore } from '@/stores/ui'
import { formatBytes, formatFramework } from '@/utils/format'

const models = useModelsStore()
const ui = useUiStore()

type TabKey = 'voices' | 'hub' | 'pymss'
type VoiceFilter = 'all' | 'favorite'
type PurposeFilter = 'all' | 'vocal_separation' | 'dereverb'

const tab = ref<TabKey>('voices')
const voiceFilter = ref<VoiceFilter>('all')
const voiceKeyword = ref('')
const pymssKeyword = ref('')
const hubKeyword = ref(models.hubQuery)
const hubFramework = ref('')
const purpose = ref<PurposeFilter>('all')
const downloadedOnly = ref(false)
const visibleCount = ref(20)
const busyModel = ref<string | null>(null)

const TABS: { key: TabKey; label: string }[] = [
  { key: 'voices', label: 'models.tabVoices' },
  { key: 'hub', label: 'models.tabHub' },
  { key: 'pymss', label: 'models.tabPymss' },
]

const voiceTabs = computed(() =>
  TABS.map((item) => ({
    ...item,
    count:
      item.key === 'voices'
        ? models.voices.length
        : item.key === 'pymss'
          ? models.pymss.length
          : models.hubTotal,
  })),
)

const filteredVoices = computed(() => {
  const text = voiceKeyword.value.trim().toLowerCase()
  return models.voices.filter((model) => {
    if (voiceFilter.value === 'favorite' && !model.favorite) return false
    if (!text) return true
    return (
      model.name.toLowerCase().includes(text) ||
      (model.framework || '').toLowerCase().includes(text) ||
      (model.tags || []).some((tag) => tag.toLowerCase().includes(text))
    )
  })
})

const pymssFiltered = computed(() => {
  const text = pymssKeyword.value.trim().toLowerCase()
  return models.pymss.filter((item) => {
    if (downloadedOnly.value && !item.downloaded) return false
    if (purpose.value !== 'all' && item.purpose !== purpose.value) return false
    if (!text) return true
    return (
      item.name.toLowerCase().includes(text) ||
      (item.category_label || '').toLowerCase().includes(text) ||
      (item.architecture || '').toLowerCase().includes(text)
    )
  })
})

const pymssVisible = computed(() => pymssFiltered.value.slice(0, visibleCount.value))
const pymssHasMore = computed(() => pymssFiltered.value.length > visibleCount.value)
const runningDownloads = computed(() => models.downloads.filter((job) => job.status === 'running'))
const hubPageCount = computed(() =>
  Math.max(1, Math.ceil(models.hubTotal / models.hubPageSize)),
)

function switchTab(next: TabKey): void {
  tab.value = next
  ui.haptic(6)
  if (next === 'pymss' && !models.pymss.length) void models.loadPymss()
  if (next === 'hub' && !models.hubItems.length) {
    void models.loadHub('', 1, '')
    void models.refreshHubJobs()
  }
}

function modelInitial(name: string): string {
  return (name.trim()[0] || 'M').toUpperCase()
}

async function toggleFavorite(model: VoiceModel): Promise<void> {
  try {
    await models.toggleFavorite(model.id)
    ui.toast(model.favorite ? '已取消收藏' : '已收藏模型', 'success')
  } catch (error) {
    ui.toast(error instanceof Error ? error.message : '操作失败', 'error')
  }
}

async function setDefault(model: VoiceModel): Promise<void> {
  if (models.defaultId === model.id) return
  try {
    await models.setDefault(model.id)
    ui.toast(`已将「${model.name}」设为默认模型`, 'success')
  } catch (error) {
    ui.toast(error instanceof Error ? error.message : '设置失败', 'error')
  }
}

async function rename(model: VoiceModel): Promise<void> {
  const name = await ui.prompt({
    title: '重命名模型',
    message: '只修改显示名称，不会改动权重、配置与模型 ID。',
    value: model.name,
    maxLength: 120,
  })
  if (!name) return
  try {
    await models.renameVoice(model.id, name)
    ui.toast('模型名称已更新', 'success')
  } catch (error) {
    ui.toast(error instanceof Error ? error.message : '重命名失败', 'error')
  }
}

async function inspect(model: VoiceModel): Promise<void> {
  busyModel.value = model.id
  try {
    const result = await models.inspect(model.id, false)
    if (result.ok) {
      ui.toast(
        result.fixed.length ? `检查通过，已修复 ${result.fixed.length} 项` : '模型检查通过',
        'success',
      )
    } else {
      const first = result.issues[0]
      const message = first?.message || first?.code || '模型文件可能不完整'
      ui.toast(`检查发现问题：${message}`, 'warn', 4200)
    }
  } catch (error) {
    ui.toast(error instanceof Error ? error.message : '检查失败', 'error')
  } finally {
    busyModel.value = null
  }
}

async function removeVoice(model: VoiceModel): Promise<void> {
  const ok = await ui.confirm({
    title: '删除声音模型？',
    message: `「${model.name}」及其在电脑端托管的模型文件会被删除，无法通过 API 恢复。`,
    confirmText: '删除模型',
    danger: true,
  })
  if (!ok) return
  busyModel.value = model.id
  try {
    await models.deleteVoice(model.id)
    ui.toast('模型已删除', 'success')
  } catch (error) {
    ui.toast(error instanceof Error ? error.message : '删除失败', 'error')
  } finally {
    busyModel.value = null
  }
}

function categoryOf(item: PymssModel): string {
  return item.category_label || item.secondary_category_label || item.primary_category_label || '未分类'
}

function targetOf(item: PymssModel): string {
  const stems = Array.isArray(item.target_stems) && item.target_stems.length
    ? item.target_stems
    : Array.isArray(item.stems) && item.stems.length
      ? item.stems
      : []
  if (stems.length) return stems.join(' / ')
  return item.target_stem || item.primary_stem || '人声 / 伴奏'
}

async function downloadPymss(item: PymssModel): Promise<void> {
  const job = models.jobForModel(item.name)
  if (job?.status === 'running') return
  try {
    await models.downloadPymss(item.name)
    ui.toast(`已开始下载 ${item.name}`, 'success')
  } catch (error) {
    ui.toast(error instanceof Error ? error.message : '下载失败', 'error')
  }
}

async function removePymss(item: PymssModel): Promise<void> {
  const ok = await ui.confirm({
    title: '删除本地分离模型？',
    message: `将删除「${item.name}」的本地权重与下载标记，下次使用时需要重新下载。`,
    confirmText: '删除',
    danger: true,
  })
  if (!ok) return
  try {
    await models.deletePymss(item.name)
    ui.toast('本地模型已删除', 'success')
  } catch (error) {
    ui.toast(error instanceof Error ? error.message : '删除失败', 'error')
  }
}

function loadMore(): void {
  visibleCount.value += 20
}

function searchHub(): void {
  void models.loadHub(hubKeyword.value, 1, hubFramework.value)
}

function chooseHubFramework(value: string): void {
  hubFramework.value = value
  void models.loadHub(hubKeyword.value, 1, value)
}

function changeHubPage(delta: number): void {
  const next = Math.min(hubPageCount.value, Math.max(1, models.hubPage + delta))
  if (next === models.hubPage) return
  void models.loadHub(models.hubQuery, next, models.hubFramework)
}

function hubJobFor(repoId: string) {
  return models.hubJobFor(repoId)
}

async function downloadHub(item: HubModelItem): Promise<void> {
  const job = hubJobFor(item.repo_id)
  if (job?.status === 'running') return
  try {
    await models.downloadHub(item.repo_id)
    ui.toast(`已开始下载「${item.name}」，完成后自动导入本地模型库`, 'success')
  } catch (error) {
    ui.toast(error instanceof Error ? error.message : '模型下载失败', 'error')
  }
}

onMounted(() => {
  if (!models.voices.length) void models.loadVoices()
  if (!models.pymss.length) void models.loadPymss()
  void models.refreshDownloads()
  void models.refreshHubJobs()
})
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <p class="kicker">{{ t('models.kicker') }}</p>
        <h1 class="page-title">{{ t('models.title') }}<span class="grad-text">{{ t('models.titleAccent') }}</span></h1>
        <p class="page-sub">{{ t('models.sub') }}</p>
      </div>
      <button
        class="icon-btn"
        type="button"
        @click="tab === 'voices' ? models.loadVoices() : models.loadPymss()"
      >
        <Icon name="refresh" :size="18" />
      </button>
    </div>

    <div class="tabs">
      <button
        v-for="item in voiceTabs"
        :key="item.key"
        class="tab"
        :class="{ on: tab === item.key }"
        type="button"
        @click="switchTab(item.key)"
      >
        {{ t(item.label) }}
        <b>{{ item.count }}</b>
      </button>
    </div>

    <!-- 声音模型 -->
    <template v-if="tab === 'voices'">
      <div class="search">
        <Icon name="search" :size="15" />
        <input v-model="voiceKeyword" type="search" placeholder="搜索模型名称、框架或标签" />
      </div>

      <div class="filters">
        <button class="filter" :class="{ on: voiceFilter === 'all' }" type="button" @click="voiceFilter = 'all'">
          全部模型
        </button>
        <button
          class="filter"
          :class="{ on: voiceFilter === 'favorite' }"
          type="button"
          @click="voiceFilter = 'favorite'"
        >
          <Icon name="star" :size="12" />
          收藏
        </button>
      </div>

      <div v-if="models.voicesLoading && !models.voices.length" class="list">
        <div v-for="n in 3" :key="n" class="skeleton" style="height: 96px"></div>
      </div>

      <div v-else-if="filteredVoices.length" class="list">
        <article v-for="model in filteredVoices" :key="model.id" class="voice-card glass">
          <div class="voice-top">
            <div class="avatar">
              <span>{{ modelInitial(model.name) }}</span>
            </div>
            <div class="voice-main">
              <div class="name-row">
                <h3>{{ model.name }}</h3>
                <span v-if="model.id === models.defaultId" class="default-tag">默认</span>
              </div>
              <p>
                {{ formatFramework(model.framework) }}
                <template v-if="model.type"> · {{ model.type }}</template>
                <template v-if="model.size"> · {{ model.size }}</template>
                <template v-if="model.sample_rate"> · {{ model.sample_rate }}</template>
              </p>
              <div v-if="model.tags?.length" class="tags">
                <span v-for="tag in model.tags.slice(0, 3)" :key="tag">{{ tag }}</span>
              </div>
            </div>
            <button
              class="star"
              :class="{ on: model.favorite }"
              type="button"
              :aria-label="model.favorite ? '取消收藏' : '收藏'"
              @click="toggleFavorite(model)"
            >
              <Icon name="star" :size="18" />
            </button>
          </div>

          <div class="voice-actions">
            <button
              class="text-btn"
              type="button"
              :disabled="model.id === models.defaultId || busyModel === model.id"
              @click="setDefault(model)"
            >
              设为默认
            </button>
            <button class="text-btn" type="button" :disabled="busyModel === model.id" @click="rename(model)">
              重命名
            </button>
            <button class="text-btn" type="button" :disabled="busyModel === model.id" @click="inspect(model)">
              {{ busyModel === model.id ? '处理中…' : '检查' }}
            </button>
            <button class="text-btn danger" type="button" :disabled="busyModel === model.id" @click="removeVoice(model)">
              删除
            </button>
          </div>
        </article>
      </div>

      <section v-else class="empty glass">
        <div class="empty-icon"><Icon name="mic" :size="26" /></div>
        <p class="empty-title">{{ models.voices.length ? '没有匹配的模型' : '电脑端还没有声音模型' }}</p>
        <p class="empty-sub">
          {{
            models.voices.length
              ? '换一个关键词或取消收藏筛选。'
              : '请先在电脑端「模型站」导入 SVC / RVC / SeedVC 模型，再回到手机刷新。'
          }}
        </p>
        <button class="btn btn--sm" type="button" @click="models.loadVoices()">重新读取</button>
      </section>

      <p class="library-note">
        <Icon name="info" :size="12" />
        手机端用于管理与删除已导入模型；下载与导入新的声音模型请在电脑端模型站完成。
      </p>
    </template>

    <!-- PyMSS 分离模型 -->
    <template v-else-if="tab === 'pymss'">
      <section class="status-card glass" :class="{ warn: !models.pymssStatus?.environment }">
        <div class="status-icon">
          <Icon name="chip" :size="18" />
        </div>
        <div class="status-text">
          <b>PyMSS Studio 模型站</b>
          <p v-if="models.pymssStatus?.environment">
            运行环境 {{ models.pymssStatus.version || '就绪' }} · 默认模型
            {{ models.pymssStatus.model || '自动' }}
          </p>
          <p v-else>电脑端 PyMSS 环境不可用，下载与分离任务会失败。</p>
        </div>
        <span class="env-dot" :class="{ ok: models.pymssStatus?.environment }"></span>
      </section>

      <div v-if="runningDownloads.length" class="download-jobs glass">
        <div class="jobs-head">
          <span class="block-title">正在下载</span>
          <span class="block-note">{{ runningDownloads.length }} 个任务</span>
        </div>
        <div v-for="job in runningDownloads" :key="job.key" class="job-row">
          <div class="job-main">
            <b class="truncate">{{ job.model }}</b>
            <span>{{ job.message || '正在下载…' }}</span>
            <div class="job-track"><i :style="{ width: `${job.pct}%` }"></i></div>
          </div>
          <span class="job-pct mono">{{ Math.round(job.pct) }}%</span>
        </div>
      </div>

      <div class="search">
        <Icon name="search" :size="15" />
        <input v-model="pymssKeyword" type="search" placeholder="搜索模型名称、分类或架构" />
      </div>

      <div class="filters">
        <button class="filter" :class="{ on: purpose === 'all' }" type="button" @click="purpose = 'all'">全部用途</button>
        <button
          class="filter"
          :class="{ on: purpose === 'vocal_separation' }"
          type="button"
          @click="purpose = 'vocal_separation'"
        >
          人声分离
        </button>
        <button
          class="filter"
          :class="{ on: purpose === 'dereverb' }"
          type="button"
          @click="purpose = 'dereverb'"
        >
          去混响
        </button>
        <button
          class="filter"
          :class="{ on: downloadedOnly }"
          type="button"
          @click="downloadedOnly = !downloadedOnly"
        >
          仅已下载
        </button>
      </div>

      <div v-if="models.pymssLoading && !models.pymss.length" class="list">
        <div v-for="n in 4" :key="n" class="skeleton" style="height: 66px"></div>
      </div>

      <div v-else-if="pymssVisible.length" class="pymss-list">
        <article v-for="item in pymssVisible" :key="item.name" class="pymss-row glass">
          <div class="pymss-head">
            <div class="pymss-title">
              <h3 class="truncate">{{ item.name }}</h3>
              <span class="arch">{{ item.architecture || 'PyMSS' }}</span>
            </div>
            <span class="downloaded" :class="{ ok: item.downloaded }">
              {{ item.downloaded ? '已下载' : '未下载' }}
            </span>
          </div>
          <p class="pymss-meta">
            {{ categoryOf(item) }} · 目标音轨 {{ targetOf(item) }}
            <template v-if="item.size_bytes"> · {{ formatBytes(item.size_bytes) }}</template>
          </p>

          <div v-if="models.jobForModel(item.name)?.status === 'running'" class="pymss-progress">
            <div class="job-track">
              <i :style="{ width: `${models.jobForModel(item.name)?.pct || 0}%` }"></i>
            </div>
            <span>{{ Math.round(models.jobForModel(item.name)?.pct || 0) }}%</span>
          </div>

          <div class="pymss-actions">
            <button
              class="pill-btn accent"
              type="button"
              :disabled="models.jobForModel(item.name)?.status === 'running'"
              @click="downloadPymss(item)"
            >
              <Icon name="download" :size="13" />
              {{ models.jobForModel(item.name)?.status === 'running' ? '下载中' : item.downloaded ? '重新下载' : '下载模型' }}
            </button>
            <button
              v-if="item.downloaded"
              class="pill-btn danger"
              type="button"
              :disabled="models.jobForModel(item.name)?.status === 'running'"
              @click="removePymss(item)"
            >
              <Icon name="trash" :size="13" />
              删除
            </button>
          </div>
        </article>

        <button v-if="pymssHasMore" class="load-more" type="button" @click="loadMore">
          加载更多（{{ pymssFiltered.length - pymssVisible.length }}）
        </button>
      </div>

      <section v-else class="empty glass">
        <div class="empty-icon"><Icon name="chip" :size="26" /></div>
        <p class="empty-title">{{ models.pymss.length ? '没有匹配的分离模型' : '暂时没有可用的 PyMSS 模型' }}</p>
        <p class="empty-sub">
          {{
            models.pymss.length
              ? '调整用途筛选或清空搜索词。'
              : '电脑端 PyMSS 目录为空，或环境尚未就绪。'
          }}
        </p>
        <button class="btn btn--sm" type="button" @click="models.loadPymss()">刷新目录</button>
      </section>

      <p class="library-note">
        <Icon name="info" :size="12" />
        下载在电脑端后台执行，离开此页也会继续；可从下载队列查看进度。
      </p>
    </template>

    <!-- 模型站 -->
    <template v-else>
      <section class="status-card glass">
        <div class="status-icon hub">
          <Icon name="cloud" :size="18" />
        </div>
        <div class="status-text">
          <b>ModelScope 模型站</b>
          <p>搜索本软件上传的声音模型，下载完成后自动导入本地模型库。</p>
        </div>
      </section>

      <div class="hub-search">
        <div class="search">
          <Icon name="search" :size="15" />
          <input
            v-model="hubKeyword"
            type="search"
            placeholder="搜索模型名称、作者或标签"
            @keyup.enter="searchHub"
          />
        </div>
        <button class="btn btn--sm btn--primary" type="button" :disabled="models.hubLoading" @click="searchHub">
          {{ models.hubLoading ? '搜索中…' : '搜索' }}
        </button>
      </div>

      <div class="filters">
        <button class="filter" :class="{ on: hubFramework === '' }" type="button" @click="chooseHubFramework('')">全部框架</button>
        <button class="filter" :class="{ on: hubFramework === 'so-vits-svc' }" type="button" @click="chooseHubFramework('so-vits-svc')">So-VITS</button>
        <button class="filter" :class="{ on: hubFramework === 'rvc' }" type="button" @click="chooseHubFramework('rvc')">RVC</button>
        <button class="filter" :class="{ on: hubFramework === 'seed-vc' }" type="button" @click="chooseHubFramework('seed-vc')">SeedVC</button>
        <button class="filter" :class="{ on: hubFramework === 'ddsp-svc' }" type="button" @click="chooseHubFramework('ddsp-svc')">DDSP</button>
      </div>

      <div v-if="models.hubError" class="hub-error">
        <Icon name="alert" :size="14" />
        <span>{{ models.hubError }}</span>
        <button class="text-link" type="button" @click="searchHub">重试</button>
      </div>

      <div v-if="models.hubLoading && !models.hubItems.length" class="list">
        <div v-for="n in 3" :key="n" class="skeleton" style="height: 108px"></div>
      </div>

      <div v-else-if="models.hubItems.length" class="hub-list">
        <article v-for="item in models.hubItems" :key="item.repo_id" class="hub-card glass">
          <div class="hub-head">
            <div class="hub-title">
              <h3 class="truncate">{{ item.name }}</h3>
              <span class="arch">{{ item.framework_label || item.framework }}</span>
            </div>
            <span v-if="models.hubInstalled(item)" class="installed-tag">
              <Icon name="check" :size="10" :stroke-width="3" />
              已安装
            </span>
          </div>
          <p class="hub-meta">
            {{ item.author || '未知作者' }}
            <template v-if="item.sample_rate"> · {{ item.sample_rate }}</template>
            <template v-if="item.version"> · {{ item.version }}</template>
          </p>
          <p v-if="item.description" class="hub-desc">{{ item.description }}</p>
          <div v-if="item.tags?.length" class="tags">
            <span v-for="tag in item.tags.slice(0, 4)" :key="tag">{{ tag }}</span>
          </div>

          <div v-if="hubJobFor(item.repo_id)?.status === 'running'" class="hub-progress">
            <div class="job-track">
              <i :style="{ width: `${hubJobFor(item.repo_id)?.pct || 0}%` }"></i>
            </div>
            <span>{{ Math.round(hubJobFor(item.repo_id)?.pct || 0) }}% · {{ hubJobFor(item.repo_id)?.msg }}</span>
          </div>
          <p v-else-if="hubJobFor(item.repo_id)?.status === 'failed'" class="hub-fail">
            {{ hubJobFor(item.repo_id)?.error || '下载失败，可重试' }}
          </p>

          <div class="hub-actions">
            <button
              class="pill-btn accent"
              type="button"
              :disabled="hubJobFor(item.repo_id)?.status === 'running'"
              @click="downloadHub(item)"
            >
              <Icon name="download" :size="13" />
              {{
                hubJobFor(item.repo_id)?.status === 'running'
                  ? '下载中'
                  : models.hubInstalled(item)
                    ? '重新下载'
                    : '下载导入'
              }}
            </button>
          </div>
        </article>
      </div>

      <section v-else class="empty glass">
        <div class="empty-icon"><Icon name="cloud" :size="26" /></div>
        <p class="empty-title">模型站没有返回结果</p>
        <p class="empty-sub">换个关键词或框架筛选；也可以确认电脑端模型站配置是否可用。</p>
        <button class="btn btn--sm" type="button" @click="searchHub">重新搜索</button>
      </section>

      <div v-if="models.hubTotal > 0" class="hub-pager">
        <button class="pager-btn" type="button" :disabled="models.hubPage <= 1" @click="changeHubPage(-1)">
          上一页
        </button>
        <span class="mono">{{ models.hubPage }} / {{ hubPageCount }} · 共 {{ models.hubTotal }} 个</span>
        <button class="pager-btn" type="button" :disabled="models.hubPage >= hubPageCount" @click="changeHubPage(1)">
          下一页
        </button>
      </div>

      <p class="library-note">
        <Icon name="info" :size="12" />
        模型站下载在电脑端后台执行，完成后自动导入；大模型可能需要数分钟。
      </p>
    </template>
  </div>
</template>

<style scoped>
.tabs {
  display: flex;
  gap: 4px;
  padding: 4px;
  border: 1px solid var(--xb-border);
  border-radius: 13px;
  background: rgba(var(--xb-bg-rgb), 0.5);
}

.tab {
  display: flex;
  flex: 1 1 0;
  align-items: center;
  justify-content: center;
  gap: 5px;
  min-height: 36px;
  border-radius: 9px;
  color: var(--xb-muted);
  font-size: 11px;
  font-weight: 700;
}

.tab b {
  padding: 0 4px;
  border-radius: 999px;
  background: rgba(var(--xb-fill-rgb), 0.08);
  font-size: 9px;
}

.tab.on {
  color: var(--xb-primary);
  background: rgba(var(--xb-primary-rgb), 0.1);
  box-shadow: inset 0 0 0 1px rgba(var(--xb-primary-rgb), 0.28);
}

.tab.on b {
  background: rgba(var(--xb-primary-rgb), 0.16);
}

.search {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 42px;
  padding: 0 12px;
  border: 1px solid var(--xb-border);
  border-radius: 13px;
  background: rgba(var(--xb-bg-rgb), 0.5);
  color: var(--xb-muted);
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

.search input::-webkit-search-cancel-button {
  display: none;
}

.filters {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  scrollbar-width: none;
}

.filters::-webkit-scrollbar {
  display: none;
}

.filter {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex: none;
  height: 31px;
  padding: 0 10px;
  border: 1px solid var(--xb-border);
  border-radius: 999px;
  background: rgba(var(--xb-fill-rgb), 0.025);
  color: var(--xb-muted);
  font-size: 10px;
  font-weight: 700;
}

.filter.on {
  border-color: rgba(var(--xb-primary-rgb), 0.5);
  background: rgba(var(--xb-primary-rgb), 0.1);
  color: var(--xb-primary);
}

.list,
.pymss-list {
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.voice-card {
  padding: 12px;
  border-radius: 16px;
}

.voice-top {
  display: flex;
  align-items: flex-start;
  gap: 9px;
}

.avatar {
  display: grid;
  place-items: center;
  flex: none;
  width: 40px;
  height: 40px;
  border: 1px solid rgba(var(--xb-primary-rgb), 0.28);
  border-radius: 13px;
  background: linear-gradient(150deg, rgba(var(--xb-primary-rgb), 0.2), rgba(var(--xb-secondary-rgb), 0.14));
  color: var(--xb-text);
  font-size: 16px;
  font-weight: 900;
}

.voice-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1 1 auto;
}

.name-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.name-row h3 {
  font-size: 13.5px;
  font-weight: 800;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.default-tag {
  flex: none;
  padding: 1px 5px;
  border-radius: 5px;
  background: rgba(var(--xb-primary-rgb), 0.14);
  color: var(--xb-primary);
  font-size: 8px;
  font-weight: 800;
}

.voice-main p {
  color: var(--xb-muted);
  font-size: 9.5px;
  line-height: 1.5;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tags {
  display: flex;
  gap: 4px;
  margin-top: 2px;
  overflow: hidden;
}

.tags span {
  flex: none;
  padding: 1px 5px;
  border: 1px solid var(--xb-border);
  border-radius: 5px;
  color: var(--xb-muted);
  font-size: 8px;
}

.star {
  flex: none;
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  border-radius: 9px;
  color: var(--xb-muted);
}

.star.on {
  color: var(--xb-warn);
}

.star.on :deep(svg) {
  fill: rgba(var(--xb-warn-rgb), 0.28);
}

.voice-actions {
  display: flex;
  gap: 5px;
  margin-top: 10px;
  padding-top: 9px;
  border-top: 1px solid var(--xb-border);
}

.text-btn {
  flex: 1 1 0;
  min-height: 28px;
  border-radius: 8px;
  color: var(--xb-muted);
  font-size: 10px;
  font-weight: 700;
}

.text-btn:disabled {
  opacity: 0.4;
}

.text-btn.danger {
  color: var(--xb-danger);
}

.text-btn:not(:disabled):active {
  background: rgba(var(--xb-primary-rgb), 0.08);
}

.status-icon.hub {
  background: rgba(var(--xb-secondary-rgb), 0.14);
  color: var(--xb-primary);
}

.hub-search {
  display: flex;
  align-items: center;
  gap: 7px;
}

.hub-search .search {
  flex: 1 1 auto;
}

.hub-search .btn {
  flex: none;
  min-width: 64px;
}

.hub-error {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 9px 11px;
  border: 1px solid rgba(var(--xb-danger-rgb), 0.3);
  border-radius: 11px;
  background: rgba(var(--xb-danger-rgb), 0.07);
  color: var(--xb-danger);
  font-size: 10px;
}

.hub-error span {
  flex: 1 1 auto;
  min-width: 0;
}

.hub-list {
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.hub-card {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 12px;
  border-radius: 15px;
}

.hub-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.hub-title {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.hub-title h3 {
  font-size: 12.5px;
  font-weight: 800;
  max-width: 220px;
}

.installed-tag {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  flex: none;
  padding: 1px 6px;
  border-radius: 999px;
  background: rgba(var(--xb-success-rgb), 0.1);
  color: var(--xb-success);
  font-size: 8.5px;
  font-weight: 800;
}

.hub-meta {
  color: var(--xb-muted);
  font-size: 9px;
  line-height: 1.45;
}

.hub-desc {
  display: -webkit-box;
  overflow: hidden;
  color: var(--xb-muted);
  font-size: 9.5px;
  line-height: 1.5;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.hub-progress {
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin-top: 3px;
  color: var(--xb-primary);
  font-size: 8.5px;
}

.hub-progress .job-track {
  margin-top: 0;
}

.hub-fail {
  margin-top: 2px;
  color: var(--xb-danger);
  font-size: 9px;
  line-height: 1.45;
}

.hub-actions {
  display: flex;
  gap: 6px;
  margin-top: 3px;
}

.hub-pager {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 2px 4px;
  color: var(--xb-muted);
  font-size: 9px;
}

.pager-btn {
  min-height: 30px;
  padding: 0 11px;
  border: 1px solid var(--xb-border);
  border-radius: 8px;
  color: var(--xb-muted);
  font-size: 10px;
  font-weight: 700;
}

.pager-btn:disabled {
  opacity: 0.35;
}

.status-card {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 11px;
  border-radius: 14px;
}

.status-card.warn {
  border-color: rgba(var(--xb-warn-rgb), 0.34);
  background: rgba(var(--xb-warn-rgb), 0.06);
}

.status-icon {
  display: grid;
  place-items: center;
  flex: none;
  width: 34px;
  height: 34px;
  border-radius: 10px;
  background: rgba(var(--xb-primary-rgb), 0.12);
  color: var(--xb-primary);
}

.status-text {
  flex: 1 1 auto;
  min-width: 0;
}

.status-text b {
  font-size: 11.5px;
}

.status-text p {
  margin-top: 1px;
  color: var(--xb-muted);
  font-size: 9.5px;
  line-height: 1.45;
}

.env-dot {
  flex: none;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--xb-danger);
  box-shadow: 0 0 8px var(--xb-danger);
}

.env-dot.ok {
  background: var(--xb-success);
  box-shadow: 0 0 8px var(--xb-success);
}

.download-jobs {
  padding: 11px;
  border-radius: 14px;
}

.jobs-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 8px;
}

.block-title {
  font-size: 11.5px;
  font-weight: 800;
}

.block-note {
  color: var(--xb-muted);
  font-size: 9px;
}

.job-row {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 6px 0;
}

.job-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1 1 auto;
}

.job-main b {
  font-size: 10.5px;
}

.job-main span {
  color: var(--xb-muted);
  font-size: 8.5px;
}

.job-track {
  height: 3px;
  margin-top: 3px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(var(--xb-fill-rgb), 0.1);
}

.job-track i {
  display: block;
  height: 100%;
  background: var(--xb-brand-gradient);
  transition: width 0.4s ease;
}

.job-pct {
  flex: none;
  color: var(--xb-primary);
  font-size: 10px;
  font-weight: 700;
}

.pymss-row {
  padding: 11px;
  border-radius: 14px;
}

.pymss-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.pymss-title {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.pymss-title h3 {
  font-size: 12px;
  font-weight: 800;
  max-width: 210px;
}

.arch {
  flex: none;
  padding: 1px 5px;
  border: 1px solid var(--xb-border);
  border-radius: 5px;
  color: var(--xb-muted);
  font-size: 8px;
  font-weight: 700;
}

.downloaded {
  flex: none;
  padding: 1px 6px;
  border-radius: 999px;
  background: rgba(var(--xb-fill-rgb), 0.06);
  color: var(--xb-muted);
  font-size: 8.5px;
  font-weight: 700;
}

.downloaded.ok {
  background: rgba(var(--xb-success-rgb), 0.1);
  color: var(--xb-success);
}

.pymss-meta {
  margin-top: 4px;
  color: var(--xb-muted);
  font-size: 9px;
  line-height: 1.5;
}

.pymss-progress {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 7px;
  color: var(--xb-primary);
  font-size: 9px;
}

.pymss-progress .job-track {
  flex: 1 1 auto;
  margin-top: 0;
}

.pymss-actions {
  display: flex;
  gap: 6px;
  margin-top: 8px;
}

.pill-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  flex: 1 1 0;
  min-height: 32px;
  border: 1px solid var(--xb-border);
  border-radius: 9px;
  color: var(--xb-muted);
  font-size: 10px;
  font-weight: 700;
}

.pill-btn.accent {
  border-color: rgba(var(--xb-primary-rgb), 0.34);
  background: rgba(var(--xb-primary-rgb), 0.08);
  color: var(--xb-primary);
}

.pill-btn.danger {
  border-color: rgba(var(--xb-danger-rgb), 0.28);
  color: var(--xb-danger);
}

.pill-btn:disabled {
  opacity: 0.5;
}

.load-more {
  align-self: center;
  margin-top: 2px;
  padding: 8px 16px;
  border: 1px solid var(--xb-border);
  border-radius: 999px;
  color: var(--xb-muted);
  font-size: 10px;
  font-weight: 700;
}

.library-note {
  display: flex;
  align-items: flex-start;
  gap: 5px;
  padding: 0 4px;
  color: var(--xb-muted);
  font-size: 9px;
  line-height: 1.55;
  opacity: 0.8;
}

.empty {
  padding: 28px 18px;
}
</style>
