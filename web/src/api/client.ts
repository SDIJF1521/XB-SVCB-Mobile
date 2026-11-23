/**
 * FastAPI 客户端。
 *
 * 与桌面端 `web/src/api` 保持同样的按资源分组的写法；差异是本客户端把
 * 传输层交给 `bridge`，以便在 APK 内使用原生 HTTP 与系统下载。
 */

import { bridge, BridgeError } from './bridge'
import type {
  CreateJobPayload,
  DownloadedMusicItem,
  HealthInfo,
  HubJob,
  HubSearchResult,
  Job,
  JobListResponse,
  JobStem,
  ModelInspectResult,
  ModelListResponse,
  MusicLyricsResult,
  MusicSearchResult,
  MusicSource,
  PymssDownloadJob,
  PymssModelListResponse,
  QueueInfo,
  SystemInfo,
  UploadDuration,
  UploadResult,
  VoiceModel,
} from './types'

let baseUrl = ''
let apiKey = ''

/** 规范化用户输入的服务地址：补全协议、去掉末尾斜杠。 */
export function normalizeServerUrl(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`
  return withScheme.replace(/\/+$/, '')
}

export function configureApi(serverUrl: string, key: string): void {
  baseUrl = normalizeServerUrl(serverUrl)
  apiKey = key.trim()
}

export function apiBaseUrl(): string {
  return baseUrl
}

export function apiKeyValue(): string {
  return apiKey
}

export function apiUrl(path: string): string {
  return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`
}

/** 模型名可能包含 `/`（如仓库式命名），按路径段编码，避免破坏路由。 */
export function encodeModelName(name: string): string {
  return name
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')
}

async function request<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
  timeoutMs = 30000,
): Promise<T> {
  if (!baseUrl) throw new BridgeError('尚未配置服务地址')
  const result = await bridge.http<T>(method, apiUrl(path), body, apiKey, timeoutMs)
  return result.data
}

export const api = {
  async health(): Promise<HealthInfo> {
    const result = await bridge.http<HealthInfo>('GET', apiUrl('/health'), undefined, apiKey, 8000)
    return result.data
  },

  system: () => request<SystemInfo>('GET', '/api/v1/system', undefined, 60000),

  listJobs: (limit = 120) => request<JobListResponse>('GET', `/api/v1/jobs?limit=${limit}`),

  getJob: (jobId: string) => request<Job>('GET', `/api/v1/jobs/${encodeURIComponent(jobId)}`),

  queue: () => request<QueueInfo>('GET', '/api/v1/jobs/queue'),

  createJob: (payload: CreateJobPayload) => request<Job>('POST', '/api/v1/jobs', payload),

  renameJob: (jobId: string, title: string) =>
    request<Job>('PATCH', `/api/v1/jobs/${encodeURIComponent(jobId)}`, { title }),

  deleteJob: (jobId: string) =>
    request<{ ok: boolean; id: string }>('DELETE', `/api/v1/jobs/${encodeURIComponent(jobId)}`),

  retryJob: (jobId: string) =>
    request<{ ok: boolean; job_id: string }>('POST', `/api/v1/jobs/${encodeURIComponent(jobId)}/retry`),

  jobAudioUrl: (jobId: string, stem: JobStem = 'output') =>
    apiUrl(`/api/v1/jobs/${encodeURIComponent(jobId)}/audio?stem=${stem}`),

  listModels: () => request<ModelListResponse>('GET', '/api/v1/models'),

  renameModel: (modelId: string, name: string) =>
    request<VoiceModel>('PATCH', `/api/v1/models/${encodeURIComponent(modelId)}`, { name }),

  toggleFavorite: (modelId: string) =>
    request<VoiceModel>('POST', `/api/v1/models/${encodeURIComponent(modelId)}/favorite`),

  setDefaultModel: (modelId: string) =>
    request<{ ok: boolean; id: string }>('POST', '/api/v1/models/default', { model_id: modelId }),

  inspectModel: (modelId: string, repair = false) =>
    request<ModelInspectResult>(
      'POST',
      `/api/v1/models/${encodeURIComponent(modelId)}/inspect?repair=${repair ? 'true' : 'false'}`,
    ),

  deleteModel: (modelId: string) =>
    request<{ ok: boolean; id: string }>('DELETE', `/api/v1/models/${encodeURIComponent(modelId)}`),

  searchHub: (query: string, page = 1, pageSize = 12, framework?: string) => {
    const params = new URLSearchParams({
      query,
      page: String(page),
      page_size: String(pageSize),
    })
    if (framework) params.set('framework', framework)
    return request<HubSearchResult>('GET', `/api/v1/hub/models?${params.toString()}`, undefined, 45000)
  },

  startHubDownload: (repoId: string) =>
    request<{ ok: boolean; key: string }>('POST', '/api/v1/hub/downloads', { repo_id: repoId }, 60000),

  listHubDownloads: () => request<{ items: HubJob[] }>('GET', '/api/v1/hub/downloads'),

  listPymssModels: () =>
    request<PymssModelListResponse>('GET', '/api/v1/preprocess/pymss/models?all_models=true', undefined, 45000),

  downloadPymssModel: (name: string) =>
    request<{ ok?: boolean; model?: string; key?: string; error?: string }>(
      'POST',
      `/api/v1/preprocess/pymss/models/${encodeModelName(name)}/download`,
      undefined,
      60000,
    ),

  deletePymssModel: (name: string) =>
    request<{ ok: boolean; id: string }>(
      'DELETE',
      `/api/v1/preprocess/pymss/models/${encodeModelName(name)}`,
    ),

  listPymssDownloads: () =>
    request<{ items: PymssDownloadJob[] }>('GET', '/api/v1/preprocess/pymss/downloads'),

  async uploadAudio(
    token: string,
    onProgress?: (pct: number, received: number, total: number) => void,
  ): Promise<UploadResult> {
    return bridge.upload(token, apiUrl('/api/v1/uploads'), apiKey, onProgress)
  },

  deleteUpload: (uploadId: string) =>
    request<{ ok: boolean }>('DELETE', `/api/v1/uploads/${encodeURIComponent(uploadId)}`),

  uploadDuration: (uploadId: string) =>
    request<UploadDuration>(
      'GET',
      `/api/v1/uploads/${encodeURIComponent(uploadId)}/duration`,
      undefined,
      30000,
    ),

  listDownloadedMusic: () =>
    request<{ items: DownloadedMusicItem[]; total: number }>('GET', '/api/v1/music/downloaded'),

  downloadedMusicAudioUrl: (name: string) =>
    apiUrl(`/api/v1/music/downloaded/${encodeURIComponent(name)}/audio`),

  deleteDownloadedMusic: (name: string) =>
    request<{ ok: boolean; id: string }>(
      'DELETE',
      `/api/v1/music/downloaded/${encodeURIComponent(name)}`,
    ),

  useDownloadedMusic: (name: string) =>
    request<UploadResult>('POST', '/api/v1/music/downloaded/use', { name }, 120000),

  downloadMusicToPc: (query: string, n: number, source?: string, songId?: string) =>
    request<{ ok: boolean; name: string; message: string }>(
      'POST',
      '/api/v1/music/downloads',
      { query, n, source: source || null, song_id: songId || null },
      180000,
    ),

  musicSources: () =>
    request<{ items: MusicSource[]; total: number; default_id?: string }>(
      'GET',
      '/api/v1/music/sources',
    ),

  searchMusic: (query: string, source?: string, limit = 15) => {
    const params = new URLSearchParams({ query, limit: String(limit) })
    if (source) params.set('source', source)
    return request<MusicSearchResult>('GET', `/api/v1/music/search?${params.toString()}`, undefined, 45000)
  },

  musicLyrics: (query: string, n: number, source?: string, songId?: string) => {
    const params = new URLSearchParams({ query, n: String(n) })
    if (source) params.set('source', source)
    if (songId) params.set('song_id', songId)
    return request<MusicLyricsResult>('GET', `/api/v1/music/lyrics?${params.toString()}`, undefined, 45000)
  },

  /** 下载成品/伴奏/人声到系统“下载”目录，返回系统下载任务 ID。 */
  downloadStem: (jobId: string, stem: JobStem, filename: string, subdir: string) =>
    bridge.download(api.jobAudioUrl(jobId, stem), apiKey, filename, subdir),
}
