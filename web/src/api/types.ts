/**
 * XB-SVCB FastAPI 数据契约。
 *
 * 字段与 `docs/api.md`、`app/api/http_server.py` 的响应模型保持一致；
 * 移动端只读取展示所需字段，不引入桌面端私有路径。
 */

export type JobStatus = 'queue' | 'running' | 'done' | 'failed'
export type JobStem = 'output' | 'instrumental' | 'vocals'
export type PipelineStatus = 'wait' | 'active' | 'done' | 'failed'
export type InferenceDevice = 'auto' | 'cuda' | 'rocm' | 'directml' | 'cpu'
export type F0Method = 'rmvpe' | 'crepe' | 'harvest' | 'pm' | 'fcpe' | 'dio' | 'parselmouth'

export interface PipelineStep {
  key: string
  label: string
  status: PipelineStatus
}

export interface PreprocessSettings {
  enabled: boolean
  engine: 'uvr' | 'pymss'
  pymss_model?: string
  harmony_removal_enabled?: boolean
  harmony_model?: string
}

export interface VocalEnhancementSettings {
  enabled: boolean
  level: 'basic' | 'advanced'
}

export interface Job {
  id: string
  title: string
  model: string
  model_id: string
  framework?: string | null
  status: JobStatus
  progress: number
  duration?: string | null
  format?: string | null
  size?: string | null
  created_at: string
  error?: string | null
  steps: PipelineStep[]
  workflow?: string | null
  preprocess?: PreprocessSettings | null
  vocal_enhancement?: VocalEnhancementSettings | null
  queue_position?: number | null
  result_url?: string | null
}

export interface JobListResponse {
  items: Job[]
  total: number
}

export interface VoiceModel {
  id: string
  name: string
  type?: string | null
  framework?: string | null
  sample_rate?: string | null
  size?: string | null
  favorite?: boolean | null
  tags?: string[] | null
}

export interface ModelListResponse {
  items: VoiceModel[]
  total: number
  default_id: string | null
}

export interface ModelInspectResult {
  ok: boolean
  model?: VoiceModel | null
  issues: { message?: string; code?: string }[]
  fixed: string[]
}

export type PymssPurpose = 'vocal_separation' | 'dereverb' | 'harmony_removal'

export interface PymssModel {
  name: string
  architecture?: string
  supported?: boolean
  category?: string
  primary_category?: string
  primary_category_label?: string
  secondary_category?: string
  secondary_category_label?: string
  category_label?: string
  purpose?: PymssPurpose | ''
  purpose_label?: string
  target_stem?: string
  target_stems?: string[]
  stems?: string[]
  primary_stem?: string
  size_bytes?: number
  downloaded?: boolean
}

export interface PymssStatus {
  ok: boolean
  environment: boolean
  model: string
  status: string
  version?: string | null
}

export interface PymssModelListResponse {
  items: PymssModel[]
  status: PymssStatus
}

export type PymssDownloadStatus = 'running' | 'done' | 'failed' | 'idle'

export interface PymssDownloadJob {
  key: string
  model: string
  status: PymssDownloadStatus
  pct: number
  message?: string
  error?: string | null
  result?: { ok?: boolean; model?: string; error?: string }
}

export interface UploadResult {
  upload_id: string
  filename: string
  size: number
}

export interface DownloadedMusicItem {
  id: string
  name: string
  size: string
}

export interface MusicSource {
  id: string
  name: string
  cookie: boolean
}

export interface MusicSongItem {
  n: number
  name: string
  singer: string
  album?: string
  rid?: string | null
}

export interface MusicSearchResult {
  ok: boolean
  error?: string | null
  keyword?: string | null
  source?: string | null
  songs?: MusicSongItem[]
}

export interface LyricLine {
  time: number
  text: string
}

export interface MusicLyricsResult {
  ok: boolean
  error?: string | null
  name?: string | null
  singer?: string | null
  lines?: LyricLine[]
}

export interface UploadDuration {
  upload_id: string
  duration: number
}

export interface QueueInfo {
  running: boolean
  pending: string[]
  size: number
}

export interface HealthInfo {
  ok: boolean
  app: string
  version: string
  api_version: string
}

export interface ToolStatus {
  key: string
  name: string
  desc: string
  version: string
  status: string
  ok: boolean
}

export interface InferenceDeviceRuntime {
  ok: boolean
  torch_version: string
  backends: string[]
  devices: { backend: string; name: string; index: number }[]
  preferred: string
  error?: string | null
  note?: string | null
}

export interface InferenceDevices {
  preferred: 'cuda' | 'rocm' | 'directml' | 'cpu'
  options: { value: InferenceDevice; label: string; backend: string; name?: string | null; frameworks: string[] }[]
  frameworks: Record<string, InferenceDeviceRuntime>
}

export interface SystemInfo {
  ready: boolean
  tools: ToolStatus[]
  inference_devices?: InferenceDevices | null
}

export interface InferenceParams {
  pitch: number
  f0_method: F0Method
  device: InferenceDevice
  auto_high_pitch_guard: boolean
  reference_audio?: string
}

export interface HubModelInstalled {
  installed: boolean
  available?: boolean
  model_id?: string
  model_name?: string
  installed_version?: string
  latest_version?: string
}

export interface HubModelItem {
  repo_id: string
  name: string
  type: string
  framework: string
  framework_label: string
  sample_rate: string
  author: string
  has_diffusion: boolean
  url: string
  description?: string
  tags?: string[]
  version?: string
  uploaded_at?: string
  score?: number
  update?: HubModelInstalled | null
}

export interface HubSearchResult {
  ok: boolean
  error?: string
  items?: HubModelItem[]
  page?: number
  page_size?: number
  total?: number
  has_more?: boolean
}

export interface HubJob {
  key: string
  kind: 'upload' | 'download'
  title: string
  status: 'running' | 'done' | 'failed'
  error?: string | null
  result?: { model?: VoiceModel; repo_id?: string } | null
  created_at?: string
  pct: number
  msg: string
  phase: string
}


export interface CreateJobPayload {
  source_upload_id: string
  model_id: string
  title?: string
  mode: 'single'
  workflow: 'auto_mix'
  reference_upload_id?: string
  params: InferenceParams
  preprocess: PreprocessSettings
  vocal_enhancement: VocalEnhancementSettings
}
