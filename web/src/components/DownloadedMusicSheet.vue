<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import Icon from '@/components/Icon.vue'
import { api } from '@/api/client'
import type { DownloadedMusicItem } from '@/api/types'
import { apiErrorMessage } from '@/utils/format'

const emit = defineEmits<{
  (event: 'close'): void
  (event: 'select', item: DownloadedMusicItem): void
}>()

const items = ref<DownloadedMusicItem[]>([])
const loading = ref(true)
const error = ref('')
const keyword = ref('')
const selecting = ref<string | null>(null)

const filtered = computed(() => {
  const text = keyword.value.trim().toLowerCase()
  if (!text) return items.value
  return items.value.filter((item) => item.name.toLowerCase().includes(text))
})

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    const result = await api.listDownloadedMusic()
    items.value = result.items
  } catch (cause) {
    error.value = apiErrorMessage(cause, '读取已下载素材失败')
  } finally {
    loading.value = false
  }
}

function choose(item: DownloadedMusicItem): void {
  if (selecting.value) return
  selecting.value = item.id
  emit('select', item)
  // 父组件成功后会卸载本面板；失败时恢复可点击，避免一直卡在加载态。
  window.setTimeout(() => {
    if (selecting.value === item.id) selecting.value = null
  }, 4000)
}

onMounted(load)
</script>

<template>
  <Teleport to="body">
    <div class="library-layer" @click.self="emit('close')">
      <section class="library-sheet">
        <header class="library-head">
          <div>
            <p class="kicker">// LIBRARY</p>
            <h2>从已下载素材选择</h2>
            <p>电脑端「资源获取」中已下载的歌曲，选中后会复制为本次任务的上传件。</p>
          </div>
          <button class="icon-btn" type="button" aria-label="关闭" @click="emit('close')">
            <Icon name="close" :size="16" />
          </button>
        </header>

        <div class="library-search">
          <Icon name="search" :size="15" />
          <input v-model="keyword" type="search" placeholder="搜索歌曲名" />
          <button type="button" aria-label="刷新" @click="load">
            <Icon name="refresh" :size="14" />
          </button>
        </div>

        <div class="library-body scroll-area">
          <div v-if="loading" class="library-list">
            <div v-for="n in 4" :key="n" class="skeleton" style="height: 52px"></div>
          </div>

          <div v-else-if="error" class="library-state">
            <Icon name="alert" :size="22" />
            <b>读取失败</b>
            <p>{{ error }}</p>
            <button class="btn btn--sm" type="button" @click="load">重试</button>
          </div>

          <div v-else-if="filtered.length" class="library-list">
            <button
              v-for="item in filtered"
              :key="item.id"
              class="library-row"
              type="button"
              :disabled="Boolean(selecting)"
              @click="choose(item)"
            >
              <span class="library-icon"><Icon name="music" :size="16" /></span>
              <span class="library-text">
                <b class="truncate">{{ item.name }}</b>
                <span>{{ item.size || '—' }}</span>
              </span>
              <span v-if="selecting === item.id" class="spinner"></span>
              <Icon v-else name="chevron" :size="14" class="library-arrow" />
            </button>
          </div>

          <div v-else class="library-state">
            <Icon name="folder" :size="22" />
            <b>{{ items.length ? '没有匹配的素材' : '还没有已下载素材' }}</b>
            <p>
              {{
                items.length
                  ? '换个关键词再试。'
                  : '请先在电脑端「资源获取」下载歌曲，再回到手机选择。'
              }}
            </p>
          </div>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.library-layer {
  position: fixed;
  inset: 0;
  z-index: 75;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgba(3, 5, 12, 0.66);
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
}

.library-sheet {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 560px;
  max-height: 88vh;
  max-height: 88dvh;
  border: 1px solid var(--xb-border);
  border-bottom: 0;
  border-radius: 22px 22px 0 0;
  background:
    radial-gradient(120% 40% at 50% 0%, rgba(var(--xb-primary-rgb), 0.08), transparent 62%),
    var(--xb-bg-2);
  box-shadow: 0 -20px 60px rgba(0, 0, 0, 0.55);
  overflow: hidden;
}

.library-head {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 16px 16px 10px;
}

.library-head > div {
  flex: 1 1 auto;
  min-width: 0;
}

.library-head h2 {
  margin-top: 4px;
  font-size: 17px;
  font-weight: 800;
}

.library-head p:last-child {
  margin-top: 3px;
  color: var(--xb-muted);
  font-size: 9.5px;
  line-height: 1.5;
}

.library-search {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 16px 10px;
  padding: 0 11px;
  height: 40px;
  border: 1px solid var(--xb-border);
  border-radius: 11px;
  background: rgba(var(--xb-bg-rgb), 0.5);
  color: var(--xb-muted);
}

.library-search:focus-within {
  border-color: rgba(var(--xb-primary-rgb), 0.5);
}

.library-search input {
  flex: 1 1 auto;
  min-width: 0;
  border: 0;
  outline: none;
  background: transparent;
  color: var(--xb-text);
  font-size: 12px;
}

.library-search button {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  color: var(--xb-muted);
}

.library-body {
  flex: 1 1 auto;
  min-height: 0;
  padding: 0 16px calc(18px + env(safe-area-inset-bottom));
  overflow-y: auto;
}

.library-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.library-row {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 9px 10px;
  border: 1px solid var(--xb-border);
  border-radius: 11px;
  background: rgba(var(--xb-fill-rgb), 0.025);
  text-align: left;
}

.library-row:active:not(:disabled) {
  border-color: rgba(var(--xb-primary-rgb), 0.5);
}

.library-icon {
  display: grid;
  place-items: center;
  flex: none;
  width: 32px;
  height: 32px;
  border-radius: 9px;
  background: rgba(var(--xb-primary-rgb), 0.1);
  color: var(--xb-primary);
}

.library-text {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
  flex: 1 1 auto;
}

.library-text b {
  font-size: 11.5px;
  font-weight: 700;
}

.library-text span {
  color: var(--xb-muted);
  font-size: 9px;
}

.library-arrow {
  color: var(--xb-muted);
}

.library-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 36px 18px;
  color: var(--xb-muted);
  text-align: center;
}

.library-state b {
  color: var(--xb-text);
  font-size: 12px;
}

.library-state p {
  max-width: 260px;
  font-size: 9.5px;
  line-height: 1.55;
}

.spinner {
  width: 15px;
  height: 15px;
  border-width: 2px;
}
</style>
