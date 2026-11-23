import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { api } from '@/api/client'
import type {
  HubJob,
  HubModelItem,
  ModelInspectResult,
  PymssDownloadJob,
  PymssModel,
  PymssStatus,
  VoiceModel,
} from '@/api/types'

/** 声音模型与 PyMSS 前期分离模型。 */
export const useModelsStore = defineStore('mobile-models', () => {
  const voices = ref<VoiceModel[]>([])
  const defaultId = ref<string | null>(null)
  const voicesLoading = ref(false)
  const voicesError = ref('')

  const pymss = ref<PymssModel[]>([])
  const pymssStatus = ref<PymssStatus | null>(null)
  const pymssLoading = ref(false)
  const pymssError = ref('')
  const downloads = ref<PymssDownloadJob[]>([])

  const hubItems = ref<HubModelItem[]>([])
  const hubTotal = ref(0)
  const hubPage = ref(1)
  const hubPageSize = 12
  const hubQuery = ref('')
  const hubFramework = ref('')
  const hubLoading = ref(false)
  const hubError = ref('')
  const hubJobs = ref<HubJob[]>([])

  let pollTimer: number | undefined
  let hubTimer: number | undefined
  let pollInFlight = false
  let hubInFlight = false

  const favoriteVoices = computed(() => voices.value.filter((model) => model.favorite))
  const downloadedPymss = computed(() => pymss.value.filter((model) => model.downloaded))
  const pymssVocalModels = computed(() =>
    pymss.value.filter(
      (model) => model.downloaded && (model.purpose === 'vocal_separation' || model.purpose === 'dereverb' || !model.purpose),
    ),
  )
  const defaultVoice = computed(
    () => voices.value.find((model) => model.id === defaultId.value) ?? null,
  )

  async function loadVoices(): Promise<void> {
    voicesLoading.value = true
    try {
      const result = await api.listModels()
      voices.value = result.items
      defaultId.value = result.default_id
      voicesError.value = ''
    } catch (error) {
      voicesError.value = error instanceof Error ? error.message : '读取声音模型失败'
    } finally {
      voicesLoading.value = false
    }
  }

  async function toggleFavorite(modelId: string): Promise<void> {
    const updated = await api.toggleFavorite(modelId)
    const index = voices.value.findIndex((model) => model.id === modelId)
    if (index >= 0) voices.value.splice(index, 1, updated)
  }

  async function renameVoice(modelId: string, name: string): Promise<void> {
    const updated = await api.renameModel(modelId, name)
    const index = voices.value.findIndex((model) => model.id === modelId)
    if (index >= 0) voices.value.splice(index, 1, updated)
  }

  async function setDefault(modelId: string): Promise<void> {
    await api.setDefaultModel(modelId)
    defaultId.value = modelId
  }

  async function deleteVoice(modelId: string): Promise<void> {
    await api.deleteModel(modelId)
    voices.value = voices.value.filter((model) => model.id !== modelId)
    if (defaultId.value === modelId) defaultId.value = null
  }

  async function inspect(modelId: string, repair: boolean): Promise<ModelInspectResult> {
    const result = await api.inspectModel(modelId, repair)
    if (result.model) {
      const index = voices.value.findIndex((model) => model.id === modelId)
      if (index >= 0) voices.value.splice(index, 1, result.model)
    }
    return result
  }

  async function loadPymss(): Promise<void> {
    pymssLoading.value = true
    try {
      const result = await api.listPymssModels()
      pymss.value = result.items
      pymssStatus.value = result.status
      pymssError.value = ''
    } catch (error) {
      pymssError.value = error instanceof Error ? error.message : '读取 PyMSS 模型列表失败'
    } finally {
      pymssLoading.value = false
    }
  }

  function jobForModel(name: string): PymssDownloadJob | undefined {
    return downloads.value.find((job) => job.model === name || job.key === `pymss:${name.replace(/\.[^.]+$/, '').toLowerCase()}`)
  }

  async function refreshDownloads(): Promise<void> {
    if (pollInFlight) return
    pollInFlight = true
    try {
      const result = await api.listPymssDownloads()
      const previous = new Map(downloads.value.map((job) => [job.key, job.status]))
      downloads.value = result.items
      const finished = result.items.some((job) => {
        const before = previous.get(job.key)
        return (before === 'running' || before === undefined) && job.status === 'done'
      })
      const anyRunning = result.items.some((job) => job.status === 'running')
      if (finished) {
        await loadPymss()
        await loadVoices()
      }
      if (anyRunning) startPolling()
      else stopPolling()
    } catch {
      // 下载列表属于辅助信息，失败时保留上一次进度。
    } finally {
      pollInFlight = false
    }
  }

  async function downloadPymss(name: string): Promise<void> {
    await api.downloadPymssModel(name)
    await refreshDownloads()
    startPolling()
  }

  async function deletePymss(name: string): Promise<void> {
    await api.deletePymssModel(name)
    const index = pymss.value.findIndex((model) => model.name === name)
    if (index >= 0) pymss.value.splice(index, 1, { ...pymss.value[index], downloaded: false })
  }

  function startPolling(): void {
    if (pollTimer !== undefined) return
    pollTimer = window.setInterval(() => void refreshDownloads(), 2000)
  }

  function stopPolling(): void {
    if (pollTimer !== undefined) {
      window.clearInterval(pollTimer)
      pollTimer = undefined
    }
  }

  async function loadHub(query = hubQuery.value, page = 1, framework = hubFramework.value): Promise<void> {
    hubLoading.value = true
    hubQuery.value = query
    hubPage.value = Math.max(1, page)
    hubFramework.value = framework
    try {
      const result = await api.searchHub(query, hubPage.value, hubPageSize, framework || undefined)
      if (!result.ok) {
        hubError.value = result.error || '模型站搜索失败'
        hubItems.value = []
        hubTotal.value = 0
        return
      }
      hubItems.value = result.items ?? []
      hubTotal.value = result.total ?? hubItems.value.length
      hubError.value = ''
    } catch (error) {
      hubError.value = error instanceof Error ? error.message : '模型站搜索失败'
    } finally {
      hubLoading.value = false
    }
  }

  function hubJobFor(repoId: string): HubJob | undefined {
    return hubJobs.value.find((job) => job.key === `dl:${repoId}`)
  }

  function hubInstalled(item: HubModelItem): boolean {
    return Boolean(item.update?.installed)
  }

  async function refreshHubJobs(): Promise<void> {
    if (hubInFlight) return
    hubInFlight = true
    try {
      const result = await api.listHubDownloads()
      const previous = new Map(hubJobs.value.map((job) => [job.key, job.status]))
      hubJobs.value = result.items
      const finished = result.items.some(
        (job) => job.status === 'done' && previous.get(job.key) !== 'done',
      )
      if (finished) {
        await loadVoices()
        await loadHub()
      }
      if (result.items.some((job) => job.status === 'running')) startHubPolling()
      else stopHubPolling()
    } catch {
      // 下载进度是辅助信息，网络抖动时保留上一次结果。
    } finally {
      hubInFlight = false
    }
  }

  async function downloadHub(repoId: string): Promise<void> {
    await api.startHubDownload(repoId)
    await refreshHubJobs()
    startHubPolling()
  }

  function startHubPolling(): void {
    if (hubTimer !== undefined) return
    hubTimer = window.setInterval(() => void refreshHubJobs(), 2000)
  }

  function stopHubPolling(): void {
    if (hubTimer !== undefined) {
      window.clearInterval(hubTimer)
      hubTimer = undefined
    }
  }

  return {
    voices,
    defaultId,
    voicesLoading,
    voicesError,
    pymss,
    pymssStatus,
    pymssLoading,
    pymssError,
    downloads,
    hubItems,
    hubTotal,
    hubPage,
    hubPageSize,
    hubQuery,
    hubFramework,
    hubLoading,
    hubError,
    hubJobs,
    favoriteVoices,
    downloadedPymss,
    pymssVocalModels,
    defaultVoice,
    loadVoices,
    toggleFavorite,
    renameVoice,
    setDefault,
    deleteVoice,
    inspect,
    loadPymss,
    jobForModel,
    downloadPymss,
    deletePymss,
    refreshDownloads,
    startPolling,
    stopPolling,
    loadHub,
    hubJobFor,
    hubInstalled,
    refreshHubJobs,
    downloadHub,
    startHubPolling,
    stopHubPolling,
  }
})
