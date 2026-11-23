import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { api, apiKeyValue } from '@/api/client'
import { bridge } from '@/api/bridge'
import type { Job, JobStem } from '@/api/types'
import { safeFilename, stemLabel } from '@/utils/format'

const RECORDS_KEY = 'xb-svcb.mobile.downloads'
const MATERIAL_KEY = 'xb-svcb.mobile.material-downloads'

export interface DownloadRecord {
  id: string
  downloadId: number
  jobId: string
  jobTitle: string
  stem: JobStem
  filename: string
  at: number
}

export interface MaterialDownloadRecord {
  id: string
  name: string
  filename: string
  at: number
}

interface AudioCacheEntry {
  path: string
  at: number
}

/** 素材下载中心：成品/伴奏/人声的落盘、试验听缓存与下载记录。 */
export const useDownloadsStore = defineStore('mobile-downloads', () => {
  const records = ref<DownloadRecord[]>(readRecords())
  const materialRecords = ref<MaterialDownloadRecord[]>(readMaterialRecords())
  const audioCache = ref<Record<string, AudioCacheEntry>>({})

  const recent = computed(() => [...records.value].sort((a, b) => b.at - a.at))
  const recentMaterials = computed(() =>
    [...materialRecords.value].sort((a, b) => b.at - a.at),
  )

  function readMaterialRecords(): MaterialDownloadRecord[] {
    try {
      const raw = localStorage.getItem(MATERIAL_KEY)
      const parsed = raw ? (JSON.parse(raw) as MaterialDownloadRecord[]) : []
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  function persistMaterials(): void {
    try {
      localStorage.setItem(MATERIAL_KEY, JSON.stringify(materialRecords.value.slice(0, 200)))
    } catch {
      // 存储不可用时保留内存记录。
    }
  }

  async function startMaterialDownload(
    item: { id: string; name: string },
    subdir: string,
  ): Promise<MaterialDownloadRecord> {
    const saved = await bridge.download(
      api.downloadedMusicAudioUrl(item.id),
      apiKeyValue(),
      item.id,
      subdir,
    )
    const record: MaterialDownloadRecord = {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      name: item.name,
      filename: saved.filename,
      at: Date.now(),
    }
    materialRecords.value.unshift(record)
    persistMaterials()
    return record
  }

  function removeMaterialRecord(id: string): void {
    materialRecords.value = materialRecords.value.filter((record) => record.id !== id)
    persistMaterials()
  }

  function clearMaterialRecords(): void {
    materialRecords.value = []
    persistMaterials()
  }

  function readRecords(): DownloadRecord[] {
    try {
      const raw = localStorage.getItem(RECORDS_KEY)
      const parsed = raw ? (JSON.parse(raw) as DownloadRecord[]) : []
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  function persist(): void {
    try {
      localStorage.setItem(RECORDS_KEY, JSON.stringify(records.value.slice(0, 200)))
    } catch {
      // 存储不可用时保留内存中的下载记录。
    }
  }

  function audioKey(jobId: string, stem: JobStem): string {
    return `${jobId}:${stem}`
  }

  function extensionFor(job: Job): string {
    const raw = (job.format || 'wav').toLowerCase().replace(/[^a-z0-9]/g, '')
    return raw || 'wav'
  }

  function filenameFor(job: Job, stem: JobStem): string {
    return `${safeFilename(job.title, job.id)}_${stemLabel(stem)}.${extensionFor(job)}`
  }

  async function startDownload(job: Job, stem: JobStem, subdir: string): Promise<DownloadRecord> {
    const filename = filenameFor(job, stem)
    const saved = await api.downloadStem(job.id, stem, filename, subdir)
    const record: DownloadRecord = {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      downloadId: saved.downloadId,
      jobId: job.id,
      jobTitle: job.title,
      stem,
      filename,
      at: Date.now(),
    }
    records.value.unshift(record)
    persist()
    return record
  }

  async function ensureAudio(
    job: Job,
    stem: JobStem = 'output',
    onProgress?: (pct: number, received: number, total: number) => void,
  ): Promise<string> {
    const key = audioKey(job.id, stem)
    const cached = audioCache.value[key]
    if (cached) return cached.path
    const result = await bridge.cacheAudio(
      api.jobAudioUrl(job.id, stem),
      apiKeyValue(),
      key.replace(':', '_'),
      extensionFor(job),
      onProgress,
    )
    audioCache.value = { ...audioCache.value, [key]: { path: result.path, at: Date.now() } }
    return result.path
  }

  function forgetAudio(jobId: string): void {
    audioCache.value = Object.fromEntries(
      Object.entries(audioCache.value).filter(([key]) => !key.startsWith(`${jobId}:`)),
    )
  }

  function removeRecord(id: string): void {
    records.value = records.value.filter((record) => record.id !== id)
    persist()
  }

  function clearRecords(): void {
    records.value = []
    persist()
  }

  return {
    records,
    materialRecords,
    recent,
    recentMaterials,
    startDownload,
    startMaterialDownload,
    ensureAudio,
    forgetAudio,
    removeRecord,
    removeMaterialRecord,
    clearRecords,
    clearMaterialRecords,
    filenameFor,
    extensionFor,
  }
})
