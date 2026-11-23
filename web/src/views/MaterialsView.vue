<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import Icon from '@/components/Icon.vue'
import { api } from '@/api/client'
import type { DownloadedMusicItem, MusicSongItem, MusicSource } from '@/api/types'
import { t, locale } from '@/i18n'
import { useUiStore } from '@/stores/ui'

const ui = useUiStore()

const items = ref<DownloadedMusicItem[]>([])
const loading = ref(true)
const error = ref('')
const keyword = ref('')
const deleting = ref<string | null>(null)

const musicQuery = ref('')
const musicSource = ref('wy')
const musicSources = ref<MusicSource[]>([
  { id: 'wy', name: '网易云音乐', cookie: false },
  { id: 'qq', name: 'QQ 音乐', cookie: true },
  { id: 'kuwo', name: '酷我音乐', cookie: false },
])
const searchResults = ref<MusicSongItem[]>([])
const searchLoading = ref(false)
const searchError = ref('')
const downloadingN = ref<number | null>(null)

const filtered = computed(() => {
  const text = keyword.value.trim().toLowerCase()
  if (!text) return items.value
  return items.value.filter((item) => item.name.toLowerCase().includes(text))
})

/** 旧版电脑端缺少新接口时，把原始 404 换成可操作的提示。 */
function friendlyError(cause: unknown): string {
  const message = cause instanceof Error ? cause.message : '请求失败'
  if (
    message === 'Not Found' ||
    message === '资源不存在' ||
    message.includes('404') ||
    message.includes('HTTP 404')
  ) {
    return '电脑端 API 版本过旧，缺少素材接口。请更新后端代码并重启 API 服务。'
  }
  return message
}

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    const result = await api.listDownloadedMusic()
    items.value = result.items
  } catch (cause) {
    error.value = friendlyError(cause)
  } finally {
    loading.value = false
  }
}

async function loadSources(): Promise<void> {
  try {
    const result = await api.musicSources()
    if (result.items?.length) {
      musicSources.value = result.items
      if (!result.items.some((source) => source.id === musicSource.value)) {
        musicSource.value = result.default_id || result.items[0].id
      }
    }
  } catch {
    // 保留内置三项。
  }
}

async function searchOnline(): Promise<void> {
  const query = musicQuery.value.trim()
  if (!query) {
    ui.toast('请输入歌曲名或歌手', 'warn')
    return
  }
  searchLoading.value = true
  searchError.value = ''
  searchResults.value = []
  try {
    const result = await api.searchMusic(query, musicSource.value, 12)
    if (!result.ok) throw new Error(result.error || '搜索素材失败')
    searchResults.value = result.songs ?? []
    if (!searchResults.value.length) searchError.value = '没有找到候选歌曲，请换关键词或曲库。'
  } catch (cause) {
    searchError.value = friendlyError(cause)
    ui.toast(searchError.value, 'error')
  } finally {
    searchLoading.value = false
  }
}

async function downloadToPc(song: MusicSongItem): Promise<void> {
  if (downloadingN.value !== null) return
  downloadingN.value = song.n
  try {
    const result = await api.downloadMusicToPc(
      musicQuery.value,
      song.n,
      musicSource.value,
      song.rid || undefined,
    )
    ui.toast(`「${result.name || song.name}」已下载到电脑端素材库`, 'success', 3200)
    await load()
  } catch (cause) {
    ui.toast(friendlyError(cause), 'error', 4200)
  } finally {
    downloadingN.value = null
  }
}

async function removeItem(item: DownloadedMusicItem): Promise<void> {
  const ok = await ui.confirm({
    title: '删除电脑端素材？',
    message: `「${item.name}」会从电脑端「资源获取」中删除，此操作会同时影响主软件。`,
    confirmText: '删除',
    danger: true,
  })
  if (!ok) return
  deleting.value = item.id
  try {
    await api.deleteDownloadedMusic(item.id)
    items.value = items.value.filter((entry) => entry.id !== item.id)
    ui.toast('电脑端素材已删除', 'success')
  } catch (cause) {
    ui.toast(friendlyError(cause), 'error')
  } finally {
    deleting.value = null
  }
}

function useForCover(item: DownloadedMusicItem): void {
  try {
    sessionStorage.setItem('xb-svcb.mobile.pending-library', JSON.stringify(item))
  } catch {
    // sessionStorage 不可用时仍可进入创建页手动选择。
  }
  window.location.hash = '#/create'
}

function goWorks(): void {
  window.location.hash = '#/tasks'
}

onMounted(() => {
  void load()
  void loadSources()
})
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <p class="kicker">{{ t('materials.kicker') }}</p>
        <h1 class="page-title">{{ t('materials.title') }}<span class="grad-text">{{ t('materials.titleAccent') }}</span></h1>
        <p class="page-sub">{{ t('materials.sub') }}</p>
      </div>
      <button class="icon-btn" type="button" :disabled="loading" @click="load">
        <Icon name="refresh" :size="18" />
      </button>
    </div>

    <section class="summary glass">
      <div class="summary-glow"></div>
      <div class="summary-item">
        <b class="mono">{{ items.length }}</b>
        <span>电脑端素材</span>
      </div>
      <div class="summary-item">
        <b class="mono accent">{{ searchResults.length }}</b>
        <span>在线候选</span>
      </div>
      <div class="summary-item">
        <b class="mono success">PC</b>
        <span>下载位置</span>
      </div>
    </section>

    <div class="notice">
      <Icon name="info" :size="13" />
      <span v-if="locale === 'zh-CN'">
        素材下载会直接在电脑端完成并进入主软件「资源获取」素材库，不保存到手机；
        翻唱作品在
        <button class="inline-link" type="button" @click="goWorks">作品页</button>
        查看。
      </span>
      <span v-else>
        Downloads happen on the PC and land in the desktop “Resources” library, never on
        this phone. Covers are in
        <button class="inline-link" type="button" @click="goWorks">Works</button>.
      </span>
    </div>

    <section class="glass search-card">
      <div class="block-head">
        <span class="block-title">在线搜索并下载到电脑</span>
        <span class="block-note">主软件素材库</span>
      </div>
      <div class="online-search">
        <input
          v-model="musicQuery"
          class="input online-input"
          type="text"
          placeholder="歌曲名 / 歌手"
          @keyup.enter="searchOnline"
        />
        <select v-model="musicSource" class="select online-source">
          <option v-for="source in musicSources" :key="source.id" :value="source.id">
            {{ source.name }}
          </option>
        </select>
        <button class="btn btn--sm btn--primary online-btn" type="button" :disabled="searchLoading" @click="searchOnline">
          <span v-if="searchLoading" class="spinner dark"></span>
          <Icon v-else name="search" :size="13" />
          搜索
        </button>
      </div>
      <p v-if="searchError" class="inline-error">{{ searchError }}</p>

      <div v-if="searchResults.length" class="online-results">
        <div v-for="song in searchResults" :key="`${song.n}-${song.name}-${song.singer}`" class="online-row">
          <div class="online-text">
            <b class="truncate">{{ song.name }}</b>
            <span>{{ song.singer }}<template v-if="song.album"> · {{ song.album }}</template></span>
          </div>
          <button
            class="download-pc"
            type="button"
            :disabled="downloadingN !== null"
            @click="downloadToPc(song)"
          >
            <span v-if="downloadingN === song.n" class="spinner"></span>
            <Icon v-else name="download" :size="13" />
            {{ downloadingN === song.n ? '下载中' : '下载到电脑' }}
          </button>
        </div>
      </div>
      <p v-else-if="!searchLoading && !searchError" class="online-tip">
        输入歌名后搜索，选择结果即可在电脑端下载；下载完成后会出现在下方素材列表。
      </p>
    </section>

    <div class="search">
      <Icon name="search" :size="15" />
      <input v-model="keyword" type="search" placeholder="搜索电脑端已下载素材" />
      <button v-if="keyword" class="clear" type="button" aria-label="清空" @click="keyword = ''">
        <Icon name="close" :size="13" />
      </button>
    </div>

    <div class="section-head">
      <h2 class="section-title">电脑端已下载素材</h2>
      <span class="section-count">{{ filtered.length }}</span>
    </div>

    <section v-if="loading" class="list">
      <div v-for="n in 4" :key="n" class="skeleton" style="height: 82px"></div>
    </section>

    <section v-else-if="error" class="empty glass">
      <div class="empty-icon"><Icon name="alert" :size="24" /></div>
      <p class="empty-title">读取素材失败</p>
      <p class="empty-sub">{{ error }}</p>
      <button class="btn btn--sm" type="button" @click="load">重试</button>
    </section>

    <section v-else-if="filtered.length" class="list">
      <article v-for="item in filtered" :key="item.id" class="material-card glass">
        <div class="material-head">
          <span class="art"><Icon name="music" :size="17" /></span>
          <div class="material-text">
            <b class="truncate">{{ item.name }}</b>
            <span>{{ item.size || '—' }} · 电脑端「资源获取」</span>
          </div>
        </div>
        <div class="material-actions">
          <button class="action accent" type="button" @click="useForCover(item)">
            <Icon name="sparkles" :size="13" />
            用于翻唱
          </button>
          <button
            class="action danger"
            type="button"
            :disabled="deleting !== null"
            @click="removeItem(item)"
          >
            <span v-if="deleting === item.id" class="spinner"></span>
            <Icon v-else name="trash" :size="13" />
            删除
          </button>
        </div>
      </article>
    </section>

    <section v-else class="empty glass">
      <div class="empty-icon"><Icon name="folder" :size="26" /></div>
      <p class="empty-title">{{ items.length ? '没有匹配的素材' : '电脑端还没有已下载素材' }}</p>
      <p class="empty-sub">
        {{
          items.length
            ? '换个关键词再试。'
            : '可以在上方搜索并下载到电脑，或先在电脑端「资源获取」下载。'
        }}
      </p>
      <button class="btn btn--sm" type="button" @click="load">刷新素材</button>
    </section>

    <p class="material-note">
      这里只管理素材；完成或进行中的翻唱作品在「作品」页，音频编辑与自定义工作流仍在电脑端。
    </p>
  </div>
</template>

<style scoped>
.summary {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  padding: 14px;
  border-radius: 16px;
  overflow: hidden;
}

.summary-glow {
  position: absolute;
  top: -60px;
  right: -30px;
  width: 150px;
  height: 150px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(var(--xb-primary-rgb), 0.14), transparent 65%);
  pointer-events: none;
}

.summary-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.summary-item b {
  font-size: 22px;
  font-weight: 800;
  line-height: 1.1;
}

.summary-item b.accent {
  color: var(--xb-primary);
}

.summary-item b.success {
  color: var(--xb-success);
}

.summary-item span {
  color: var(--xb-muted);
  font-size: 9px;
}

.notice {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding: 9px 10px;
  border: 1px solid var(--xb-border);
  border-radius: 10px;
  background: rgba(var(--xb-fill-rgb), 0.025);
  color: var(--xb-muted);
  font-size: 9px;
  line-height: 1.55;
}

.inline-link {
  color: var(--xb-primary);
  font-size: inherit;
  font-weight: 700;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.search-card {
  display: flex;
  flex-direction: column;
  gap: 9px;
  padding: 12px;
  border-radius: 15px;
}

.block-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.block-title {
  font-size: 11.5px;
  font-weight: 800;
}

.block-note {
  color: var(--xb-muted);
  font-size: 8.5px;
}

.online-search {
  display: flex;
  align-items: center;
  gap: 6px;
}

.online-input {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 38px;
  padding: 6px 9px;
  font-size: 11px;
}

.online-source {
  flex: 0 0 112px;
  width: 112px;
  min-height: 38px;
  padding: 4px 6px;
  font-size: 10px;
}

.online-btn {
  flex: none;
  min-height: 38px;
  padding: 0 10px;
}

.inline-error {
  color: var(--xb-danger);
  font-size: 9px;
  line-height: 1.5;
}

.online-results {
  display: flex;
  flex-direction: column;
  gap: 5px;
  max-height: 220px;
  overflow-y: auto;
}

.online-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 8px;
  border: 1px solid var(--xb-border);
  border-radius: 9px;
  background: rgba(var(--xb-fill-rgb), 0.02);
}

.online-text {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
  flex: 1 1 auto;
}

.online-text b {
  font-size: 10.5px;
}

.online-text span {
  color: var(--xb-muted);
  font-size: 8.5px;
}

.download-pc {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex: none;
  min-height: 30px;
  padding: 0 9px;
  border: 1px solid rgba(var(--xb-primary-rgb), 0.34);
  border-radius: 8px;
  background: rgba(var(--xb-primary-rgb), 0.08);
  color: var(--xb-primary);
  font-size: 9px;
  font-weight: 700;
}

.download-pc:disabled {
  opacity: 0.55;
}

.online-tip {
  color: var(--xb-muted);
  font-size: 8.5px;
  line-height: 1.5;
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

.clear {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: rgba(var(--xb-fill-rgb), 0.08);
  color: var(--xb-muted);
}

.list {
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.material-card {
  padding: 11px;
  border-radius: 15px;
}

.material-head {
  display: flex;
  align-items: center;
  gap: 9px;
}

.art {
  display: grid;
  place-items: center;
  flex: none;
  width: 36px;
  height: 36px;
  border-radius: 11px;
  background: rgba(var(--xb-primary-rgb), 0.11);
  color: var(--xb-primary);
}

.material-text {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
  flex: 1 1 auto;
}

.material-text b {
  font-size: 12px;
  font-weight: 800;
}

.material-text span {
  color: var(--xb-muted);
  font-size: 8.5px;
}

.material-actions {
  display: flex;
  gap: 6px;
  margin-top: 9px;
  padding-top: 8px;
  border-top: 1px solid var(--xb-border);
}

.action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  flex: 1 1 0;
  min-height: 32px;
  border: 1px solid var(--xb-border);
  border-radius: 9px;
  color: var(--xb-muted);
  font-size: 9.5px;
  font-weight: 700;
}

.action.accent {
  border-color: rgba(var(--xb-primary-rgb), 0.34);
  background: rgba(var(--xb-primary-rgb), 0.08);
  color: var(--xb-primary);
}

.action.danger {
  flex: 0 0 86px;
  color: var(--xb-danger);
  border-color: rgba(var(--xb-danger-rgb), 0.26);
}

.action:disabled {
  opacity: 0.5;
}

.section-count {
  padding: 1px 7px;
  border-radius: 999px;
  background: rgba(var(--xb-primary-rgb), 0.1);
  color: var(--xb-primary);
  font-size: 9px;
  font-weight: 800;
}

.empty {
  padding: 26px 18px;
}

.material-note {
  padding: 0 4px;
  color: var(--xb-muted);
  font-size: 9px;
  line-height: 1.55;
  text-align: center;
  opacity: 0.75;
}

.spinner {
  width: 13px;
  height: 13px;
  border-width: 2px;
}

.spinner.dark {
  border-color: rgba(0, 0, 0, 0.2);
  border-top-color: var(--xb-on-primary);
}
</style>
