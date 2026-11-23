<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'

import AiParamsPanel from '@/components/AiParamsPanel.vue'
import DownloadedMusicSheet from '@/components/DownloadedMusicSheet.vue'
import Icon from '@/components/Icon.vue'
import ModelParamsPanel from '@/components/ModelParamsPanel.vue'
import PymssModelPicker from '@/components/PymssModelPicker.vue'
import SegmentEditor from '@/components/SegmentEditor.vue'
import { t } from '@/i18n'
import { api } from '@/api/client'
import { bridge } from '@/api/bridge'
import type {
  CreateJobPayload,
  DownloadedMusicItem,
  F0Method,
  InferenceDevice,
  LyricLine,
  MusicSongItem,
  MusicSource,
  UploadResult,
} from '@/api/types'
import type { PickedFile as PickedFileType } from '@/api/bridge'
import { useConfigStore } from '@/stores/config'
import { useModelsStore } from '@/stores/models'
import { useTasksStore } from '@/stores/tasks'
import { useUiStore } from '@/stores/ui'
import {
  defaultAiParams,
  defaultModelParams,
  newSegment,
  type SegmentDraft,
} from '@/types/create'
import {
  apiErrorMessage,
  formatBytes,
  formatFramework,
  titleFromFilename,
} from '@/utils/format'
import { coverSeparationModels } from '@/utils/pymss'

const config = useConfigStore()
const models = useModelsStore()
const tasks = useTasksStore()
const ui = useUiStore()

const SUPPORTED = ['aac', 'flac', 'm4a', 'mkv', 'mov', 'mp3', 'mp4', 'ogg', 'opus', 'wav', 'webm', 'wma']

const song = ref<PickedFileType | null>(null)
const songUpload = ref<UploadResult | null>(null)
const songPct = ref(0)
const songUploading = ref(false)
const songError = ref('')
const songDuration = ref(0)

const reference = ref<PickedFileType | null>(null)
const referenceUpload = ref<UploadResult | null>(null)
const referencePct = ref(0)
const referenceUploading = ref(false)
const referenceError = ref('')

const title = ref('')
const songName = ref('')
const pitch = ref(0)
const mode = ref<'single' | 'multi'>('single')
const selectedModelId = ref('')
const multiModelIds = ref<string[]>([])
const segments = ref<SegmentDraft[]>([])
const segmentsCustomized = ref(false)
const duration = computed(() => songDuration.value)
const libraryOpen = ref(false)

const lyricSource = ref('wy')
const lyricSources = ref<MusicSource[]>([
  { id: 'wy', name: '网易云音乐', cookie: false },
  { id: 'qq', name: 'QQ 音乐', cookie: true },
  { id: 'kuwo', name: '酷我音乐', cookie: false },
])
const lyricQuery = ref('')
const lyricResults = ref<MusicSongItem[]>([])
const lyricSelected = ref<MusicSongItem | null>(null)
const lyricLines = ref<LyricLine[]>([])
const lyricLoading = ref(false)
const lyricError = ref('')

const modelParams = reactive(defaultModelParams())
const aiParams = reactive(defaultAiParams())

const f0 = ref<F0Method>('rmvpe')
const device = ref<InferenceDevice>('auto')
const guard = ref(true)
const preprocessEnabled = ref(true)
const engine = ref<'uvr' | 'pymss'>('uvr')
const pymssModel = ref('')
const harmony = ref(false)
const harmonyModel = ref('')
const modelParamsOpen = ref(false)
const advancedOpen = ref(false)
const submitting = ref(false)
const submitted = ref(false)

const selectedModel = computed(
  () => models.voices.find((model) => model.id === selectedModelId.value) ?? null,
)

const selectedModels = computed(() => {
  if (mode.value === 'single') return selectedModel.value ? [selectedModel.value] : []
  return models.voices.filter((model) => multiModelIds.value.includes(model.id))
})

const primaryFramework = computed(() => {
  const modelsInUse = selectedModels.value
  if (!modelsInUse.length) return null
  const primary = modelsInUse.find((model) => model.framework !== 'seed-vc') ?? modelsInUse[0]
  return primary.framework
})

const needsReference = computed(() =>
  selectedModels.value.some((model) => model.framework === 'seed-vc'),
)

const pymssReady = computed(() => coverSeparationModels(models.pymss))

const dereverbReady = computed(() =>
  models.pymss.filter((item) => item.downloaded && item.purpose === 'dereverb'),
)

const f0Options = computed<F0Method[]>(() => {
  if (primaryFramework.value === 'ddsp-svc') {
    return ['rmvpe', 'fcpe', 'dio', 'parselmouth', 'harvest']
  }
  return ['rmvpe', 'crepe', 'harvest', 'pm']
})

const DEVICES: InferenceDevice[] = ['auto', 'cuda', 'rocm', 'directml', 'cpu']

interface DeviceOption {
  value: InferenceDevice
  label: string
  name: string
  disabled: boolean
}

const deviceOptions = computed<DeviceOption[]>(() => {
  const info = config.system?.inference_devices
  const framework = primaryFramework.value
  if (!info?.options?.length) {
    return DEVICES.map((value) => ({
      value,
      label: value === 'auto' ? '自动' : value.toUpperCase(),
      name: '',
      disabled: value !== 'auto',
    }))
  }
  return info.options
    .filter(
      (option) =>
        option.value === 'auto' ||
        !framework ||
        option.frameworks.includes(framework) ||
        option.value === 'cpu',
    )
    .map((option) => ({
      value: option.value,
      label: option.label || (option.value === 'auto' ? '自动' : option.value.toUpperCase()),
      name: option.name || '',
      disabled: false,
    }))
})

const selectedDeviceName = computed(
  () => deviceOptions.value.find((option) => option.value === device.value)?.name || '',
)

const deviceHint = computed(() => {
  if (!config.system?.inference_devices?.options?.length) {
    return '未读取到电脑端推理设备信息，手动后端可能不可用；建议保持自动。'
  }
  if (device.value === 'auto') return '自动模式会按电脑端环境选择当前框架可用的后端。'
  return selectedDeviceName.value
    ? `当前设备：${selectedDeviceName.value}`
    : `已选择 ${device.value.toUpperCase()} 后端。`
})

const segmentsValid = computed(() => {
  if (segments.value.length === 0) return false
  const ordered = [...segments.value].sort((a, b) => a.start - b.start)
  let previousEnd = -1
  for (const segment of ordered) {
    if (!Number.isFinite(segment.start) || !Number.isFinite(segment.end)) return false
    if (segment.end <= segment.start) return false
    if (previousEnd >= 0 && segment.start < previousEnd - 0.01) return false
    if (!segment.modelIds.length) return false
    if (segment.modelIds.some((id) => !multiModelIds.value.includes(id))) return false
    previousEnd = segment.end
  }
  return true
})

const canSubmit = computed(
  () =>
    Boolean(songUpload.value) &&
    selectedModels.value.length > 0 &&
    !songUploading.value &&
    !referenceUploading.value &&
    !submitting.value &&
    (!needsReference.value || Boolean(referenceUpload.value)) &&
    (!preprocessEnabled.value || engine.value !== 'pymss' || Boolean(pymssModel.value)) &&
    (mode.value === 'single' || (selectedModels.value.length >= 2 && segmentsValid.value)),
)

const blockReason = computed(() => {
  if (!song.value) return '请选择要翻唱的歌曲'
  if (songUploading.value) return '歌曲正在上传…'
  if (!songUpload.value) return songError.value || '歌曲尚未上传完成'
  if (!selectedModels.value.length) return '请选择一个声音模型'
  if (mode.value === 'multi' && selectedModels.value.length < 2) return '多模型模式至少选择 2 个模型'
  if (mode.value === 'multi' && !segmentsValid.value) return '请检查演唱分段是否完整、无重叠'
  if (needsReference.value && !referenceUpload.value) return 'SeedVC 需要上传目标音色参考音频'
  if (preprocessEnabled.value && engine.value === 'pymss' && !pymssModel.value) {
    return '请选择已下载的 PyMSS 分离模型'
  }
  return ''
})

const summary = computed(() => {
  if (!selectedModels.value.length) return '先选歌曲和模型'
  if (mode.value === 'multi') {
    return `${selectedModels.value.length} 个模型 · ${segments.value.length} 段`
  }
  return `${selectedModels.value[0].name} · ${needsReference.value ? 'SeedVC' : f0.value.toUpperCase()}`
})

function goBack(): void {
  window.location.hash = '#/tasks'
}

async function confirmLeave(): Promise<boolean> {
  if (!song.value || submitted.value) return true
  return ui.confirm({
    title: '放弃这次创建？',
    message: '已上传的临时音频会被清理，当前参数不会保存。',
    confirmText: '放弃',
    danger: true,
  })
}

async function back(): Promise<void> {
  if (await confirmLeave()) goBack()
}

function extensionOf(name: string): string {
  return name.split('.').pop()?.toLowerCase() || ''
}

async function pickSong(): Promise<void> {
  if (songUploading.value) return
  try {
    const picked = await bridge.pickAudio()
    if (!SUPPORTED.includes(extensionOf(picked.name))) {
      ui.toast('不支持该格式，请选择 MP3 / WAV / FLAC 等音频文件', 'error')
      return
    }
    await discardSong()
    song.value = picked
    songPct.value = 0
    songError.value = ''
    if (!title.value.trim()) title.value = titleFromFilename(picked.name)
    await uploadSong()
  } catch (error) {
    if (error instanceof Error && error.message.includes('取消')) return
    ui.toast(error instanceof Error ? error.message : '选择文件失败', 'error')
  }
}

async function uploadSong(): Promise<void> {
  if (!song.value) return
  songUploading.value = true
  songError.value = ''
  songPct.value = 0
  try {
    songUpload.value = await api.uploadAudio(song.value.token, (pct) => {
      songPct.value = Math.min(99, Math.round(pct))
    })
    songPct.value = 100
    const measured = await api.uploadDuration(songUpload.value.upload_id).catch(() => null)
    songDuration.value = measured?.duration || (await bridge.probeAudio(song.value.token))
    if (!songName.value.trim()) songName.value = titleFromFilename(song.value.name)
    if (lyricLines.value.length && mode.value === 'multi') buildSegmentsFromLyrics()
    else ensureSegments(true)
    ui.toast('歌曲已上传到电脑端', 'success')
  } catch (error) {
    songError.value = error instanceof Error ? error.message : '上传失败'
    songUpload.value = null
    ui.toast(songError.value, 'error')
  } finally {
    songUploading.value = false
  }
}

async function discardSong(): Promise<void> {
  if (songUpload.value) {
    const id = songUpload.value.upload_id
    songUpload.value = null
    void api.deleteUpload(id).catch(() => undefined)
  }
  song.value = null
  songPct.value = 0
  songError.value = ''
  songDuration.value = 0
  segments.value = []
  segmentsCustomized.value = false
  lyricLines.value = []
  lyricSelected.value = null
  lyricResults.value = []
  lyricError.value = ''
}

async function removeSong(): Promise<void> {
  if (songUploading.value) return
  await discardSong()
  title.value = ''
  songName.value = ''
}

function openLibrary(): void {
  ui.haptic(8)
  libraryOpen.value = true
}

async function useLibrary(item: DownloadedMusicItem): Promise<void> {
  try {
    const upload = await api.useDownloadedMusic(item.id)
    await discardSong()
    song.value = {
      token: `library:${item.id}`,
      name: upload.filename,
      size: upload.size,
      mime: 'audio/*',
    }
    songUpload.value = upload
    songPct.value = 100
    songError.value = ''
    if (!title.value.trim()) title.value = titleFromFilename(item.name)
    if (!songName.value.trim()) songName.value = titleFromFilename(item.name)
    const measured = await api.uploadDuration(upload.upload_id).catch(() => null)
    songDuration.value = measured?.duration || 0
    if (lyricLines.value.length && mode.value === 'multi') buildSegmentsFromLyrics()
    else ensureSegments(true)
    libraryOpen.value = false
    ui.toast(`已选用「${item.name}」`, 'success')
  } catch (error) {
    ui.toast(apiErrorMessage(error, '选用素材失败'), 'error')
  }
}

async function loadMusicSources(): Promise<void> {
  try {
    const result = await api.musicSources()
    if (result.items?.length) {
      lyricSources.value = result.items
      if (!result.items.some((source) => source.id === lyricSource.value)) {
        lyricSource.value = result.default_id || result.items[0].id
      }
    }
  } catch {
    // 曲库列表失败时保留内置的 wy / qq / kuwo 三项。
  }
}

async function searchLyrics(): Promise<void> {
  const query = songName.value.trim() || title.value.trim()
  if (!query) {
    ui.toast('请先填写歌曲名称，或上传歌曲自动填入', 'warn')
    return
  }
  lyricLoading.value = true
  lyricError.value = ''
  lyricResults.value = []
  lyricSelected.value = null
  lyricQuery.value = query
  try {
    const result = await api.searchMusic(query, lyricSource.value, 12)
    if (!result.ok) throw new Error(result.error || '歌词搜索失败')
    lyricResults.value = result.songs ?? []
    if (!lyricResults.value.length) {
      lyricError.value = '没有找到候选歌曲，请换歌名或曲库重试。'
    } else if (lyricResults.value.length === 1) {
      await chooseLyric(lyricResults.value[0])
    }
  } catch (error) {
    lyricError.value = apiErrorMessage(error, '歌词搜索失败')
    ui.toast(lyricError.value, 'error')
  } finally {
    lyricLoading.value = false
  }
}

async function chooseLyric(song: MusicSongItem): Promise<void> {
  lyricLoading.value = true
  lyricError.value = ''
  try {
    const result = await api.musicLyrics(
      lyricQuery.value,
      song.n,
      lyricSource.value,
      song.rid || undefined,
    )
    if (!result.ok || !result.lines?.length) {
      throw new Error(result.error || '没有获取到带时间轴的歌词')
    }
    lyricSelected.value = song
    lyricLines.value = result.lines
    if (!title.value.trim()) title.value = result.name || song.name
    if (!songName.value.trim()) {
      songName.value = result.singer ? `${result.name} - ${result.singer}` : result.name
    }
    buildSegmentsFromLyrics()
    ui.toast(`已载入 ${result.lines.length} 句歌词并生成分段`, 'success')
  } catch (error) {
    lyricError.value = apiErrorMessage(error, '歌词获取失败')
    ui.toast(lyricError.value, 'error')
  } finally {
    lyricLoading.value = false
  }
}

function buildSegmentsFromLyrics(): void {
  if (mode.value !== 'multi' || multiModelIds.value.length < 2 || !lyricLines.value.length) return
  const lines = lyricLines.value
  const ids = multiModelIds.value
  const lastEnd =
    songDuration.value || (lines[lines.length - 1] ? lines[lines.length - 1].time + 8 : 8)
  segments.value = lines.map((line, index) => {
    const start = Math.max(0, Math.round((line.time - 0.4) * 10) / 10)
    const next = lines[index + 1]
    const end = next
      ? Math.max(start + 0.6, Math.round((next.time - 0.4) * 10) / 10)
      : Math.max(start + 2, Math.round(lastEnd * 10) / 10)
    return newSegment(start, end, [ids[index % ids.length]], line.text)
  })
  segmentsCustomized.value = true
}


async function pickReference(): Promise<void> {
  if (referenceUploading.value) return
  try {
    const picked = await bridge.pickAudio()
    if (!SUPPORTED.includes(extensionOf(picked.name))) {
      ui.toast('参考音频格式不受支持', 'error')
      return
    }
    await discardReference()
    reference.value = picked
    referencePct.value = 0
    referenceUploading.value = true
    referenceError.value = ''
    try {
      referenceUpload.value = await api.uploadAudio(picked.token, (pct) => {
        referencePct.value = Math.min(99, Math.round(pct))
      })
      referencePct.value = 100
      ui.toast('参考音频已上传', 'success')
    } catch (error) {
      referenceError.value = error instanceof Error ? error.message : '参考音频上传失败'
      ui.toast(referenceError.value, 'error')
    } finally {
      referenceUploading.value = false
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('取消')) return
    ui.toast(error instanceof Error ? error.message : '选择文件失败', 'error')
  }
}

async function discardReference(): Promise<void> {
  if (referenceUpload.value) {
    const id = referenceUpload.value.upload_id
    referenceUpload.value = null
    void api.deleteUpload(id).catch(() => undefined)
  }
  reference.value = null
  referencePct.value = 0
}

async function removeReference(): Promise<void> {
  if (referenceUploading.value) return
  await discardReference()
}

function stepPitch(delta: number): void {
  pitch.value = Math.max(-12, Math.min(12, pitch.value + delta))
  void ui.haptic(6)
}

function resetPitch(): void {
  pitch.value = 0
}

function isModelSelected(modelId: string): boolean {
  return mode.value === 'single' ? selectedModelId.value === modelId : multiModelIds.value.includes(modelId)
}

function selectModel(modelId: string): void {
  if (mode.value === 'single') {
    selectedModelId.value = modelId
    return
  }
  if (multiModelIds.value.includes(modelId)) {
    multiModelIds.value = multiModelIds.value.filter((id) => id !== modelId)
  } else {
    multiModelIds.value = [...multiModelIds.value, modelId]
  }
  ensureSegments()
}

function ensureSegments(force = false): void {
  if (mode.value !== 'multi') {
    segments.value = []
    return
  }
  if (multiModelIds.value.length < 2) {
    segments.value = []
    return
  }
  if (segments.value.length && !force) {
    segments.value = segments.value.map((segment) => {
      const kept = segment.modelIds.filter((id) => multiModelIds.value.includes(id))
      return { ...segment, modelIds: kept.length ? kept : [multiModelIds.value[0]] }
    })
    return
  }
  const count = Math.max(2, Math.min(4, multiModelIds.value.length))
  const length = songDuration.value > 0 ? songDuration.value : 60 * count
  const step = length / count
  segmentsCustomized.value = false
  segments.value = Array.from({ length: count }, (_, index) => {
    const start = Math.round(index * step * 10) / 10
    const end = Math.round((index === count - 1 ? length : (index + 1) * step) * 10) / 10
    return newSegment(start, end, [multiModelIds.value[index % multiModelIds.value.length]])
  })
}

function onSegmentsUpdate(next: SegmentDraft[]): void {
  segments.value = next
  segmentsCustomized.value = true
}

function buildParams(): Record<string, unknown> {
  const params: Record<string, unknown> = {
    pitch: pitch.value,
    f0_method: f0.value,
    device: device.value,
    auto_high_pitch_guard: guard.value,
    diffusion_ratio: modelParams.diffusionRatio,
    speaker: modelParams.speaker,
    index_rate: modelParams.indexRate,
    rms_mix: modelParams.rmsMix,
    protect: modelParams.protect,
    filter_radius: Math.round(modelParams.filterRadius),
    rvc_version: modelParams.rvcVersion,
    ddsp_infer_steps: Math.round(modelParams.ddspSteps),
    ddsp_formant_shift: modelParams.ddspFormant,
    manual_params_enabled: modelParams.manual,
  }
  if (modelParams.manual) {
    params.high_pitch_guard_rounds = Math.round(modelParams.guardRounds)
    params.f0_filter_threshold = modelParams.f0Threshold
  }
  return params
}

function buildPreprocess(): Record<string, unknown> {
  return {
    enabled: preprocessEnabled.value,
    engine: engine.value,
    ...(engine.value === 'pymss' && pymssModel.value ? { pymss_model: pymssModel.value } : {}),
    harmony_removal_enabled: engine.value === 'pymss' ? harmony.value : false,
    ...(engine.value === 'pymss' && harmony.value && harmonyModel.value
      ? { harmony_model: harmonyModel.value }
      : {}),
  }
}

function buildEnhancement(): Record<string, unknown> {
  return {
    enabled: aiParams.enabled,
    level: aiParams.level,
    pitch_correction: aiParams.pitchCorrection,
    timing_alignment: aiParams.timingAlignment,
    timbre_focus: aiParams.timbreFocus,
    ai_eq: aiParams.aiEq,
    ai_compressor: aiParams.aiCompressor,
    ai_exciter: aiParams.aiExciter,
    stereo_width: aiParams.stereoWidth,
    loudness_envelope: aiParams.loudnessEnvelope,
  }
}

watch(selectedModelId, () => {
  if (!f0Options.value.includes(f0.value)) f0.value = 'rmvpe'
})

watch(needsReference, (value) => {
  if (!value) void discardReference()
})

watch(mode, (value) => {
  if (value === 'multi') {
    if (multiModelIds.value.length < 2) {
      multiModelIds.value = models.voices.slice(0, 2).map((model) => model.id)
    }
    if (lyricLines.value.length) buildSegmentsFromLyrics()
    else ensureSegments(true)
  } else {
    segments.value = []
  }
})

watch(multiModelIds, () => ensureSegments())
watch(songDuration, () => {
  if (mode.value === 'multi' && !segmentsCustomized.value) ensureSegments(true)
})

watch(engine, (value) => {
  if (value === 'pymss' && !pymssModel.value && pymssReady.value.length) {
    pymssModel.value = pymssReady.value[0].name
  }
  if (value === 'uvr') {
    harmony.value = false
    harmonyModel.value = ''
  }
})

// PyMSS 目录异步返回后，如果已经切到该引擎，自动选中第一个已下载模型。
watch(
  () => pymssReady.value.length,
  () => {
    if (engine.value === 'pymss' && !pymssModel.value && pymssReady.value.length) {
      pymssModel.value = pymssReady.value[0].name
    }
  },
)

watch(
  () => dereverbReady.value.length,
  () => {
    if (harmony.value && !harmonyModel.value && dereverbReady.value.length) {
      harmonyModel.value = dereverbReady.value[0].name
    }
  },
)

async function submit(): Promise<void> {
  if (!canSubmit.value || !songUpload.value || !selectedModels.value.length) {
    if (blockReason.value) ui.toast(blockReason.value, 'warn')
    return
  }
  submitting.value = true
  try {
    const params = buildParams()
    const preprocess = buildPreprocess()
    const vocalEnhancement = buildEnhancement()
    const referenceId = needsReference.value && referenceUpload.value
      ? referenceUpload.value.upload_id
      : undefined
    const payload = mode.value === 'single'
      ? {
          source_upload_id: songUpload.value.upload_id,
          model_id: selectedModels.value[0].id,
          title: title.value.trim() || undefined,
          mode: 'single' as const,
          workflow: 'auto_mix' as const,
          ...(referenceId ? { reference_upload_id: referenceId } : {}),
          params,
          preprocess,
          vocal_enhancement: vocalEnhancement,
        }
      : {
          source_upload_id: songUpload.value.upload_id,
          title: title.value.trim() || undefined,
          mode: 'multi' as const,
          workflow: 'auto_mix' as const,
          models: selectedModels.value.map((model) => ({
            model_id: model.id,
            params,
            ...(model.framework === 'seed-vc' && referenceId
              ? { reference_upload_id: referenceId }
              : {}),
          })),
          segments: [...segments.value]
            .sort((a, b) => a.start - b.start)
            .map((segment) => ({
              start: segment.start,
              end: segment.end,
              model_ids: segment.modelIds,
            })),
          params,
          preprocess,
          vocal_enhancement: vocalEnhancement,
        }
    const job = await tasks.create(payload as CreateJobPayload)
    submitted.value = true
    ui.toast(`「${job.title}」已加入推理队列`, 'success')
    void ui.haptic(18)
    window.location.hash = '#/tasks'
  } catch (error) {
    ui.toast(error instanceof Error ? error.message : '创建任务失败', 'error')
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  void models.loadVoices()
  void models.loadPymss()
  void config.refreshSystem()
  void loadMusicSources()
  const pending = sessionStorage.getItem('xb-svcb.mobile.pending-library')
  if (pending) {
    sessionStorage.removeItem('xb-svcb.mobile.pending-library')
    try {
      const item = JSON.parse(pending) as DownloadedMusicItem
      if (item?.id) void useLibrary(item)
    } catch {
      // 忽略损坏的临时选择。
    }
  }
})

// 模型列表异步返回后，自动选中默认模型；用户已手动选择时不覆盖。
watch(
  () => models.voices.length,
  () => {
    if (!selectedModelId.value && models.voices.length) {
      selectedModelId.value = models.defaultId || models.voices[0].id
    }
    if (mode.value === 'multi' && multiModelIds.value.length < 2 && models.voices.length >= 2) {
      multiModelIds.value = models.voices.slice(0, 2).map((model) => model.id)
      ensureSegments(true)
    }
  },
  { immediate: true },
)

watch(primaryFramework, () => {
  if (!f0Options.value.includes(f0.value)) f0.value = 'rmvpe'
  if (!deviceOptions.value.some((option) => option.value === device.value && !option.disabled)) {
    device.value = 'auto'
  }
})

watch(
  () => config.system,
  () => {
    if (!deviceOptions.value.some((option) => option.value === device.value && !option.disabled)) {
      device.value = 'auto'
    }
  },
)

onBeforeUnmount(() => {
  if (!submitted.value) {
    if (songUpload.value) void api.deleteUpload(songUpload.value.upload_id).catch(() => undefined)
    if (referenceUpload.value) void api.deleteUpload(referenceUpload.value.upload_id).catch(() => undefined)
  }
})
</script>

<template>
  <div class="create-page">
    <header class="create-head">
      <button class="icon-btn" type="button" aria-label="返回" @click="back">
        <Icon name="arrow-left" :size="18" />
      </button>
      <div class="head-text">
        <p class="kicker">{{ t('create.kicker') }}</p>
        <h1>{{ t('create.title') }}</h1>
      </div>
      <span class="head-tag">{{ mode === 'single' ? t('create.single') : t('create.multi') }}</span>
    </header>

    <div class="create-body">
      <div class="intro">
        <span class="wave-bars"><i v-for="n in 5" :key="n" :style="{ animationDelay: `${n * 0.1}s` }"></i></span>
        <p>选歌 → 挑模型 → 调参数，推理会在电脑端自动排队执行。</p>
      </div>

      <section class="glass create-card">
        <div class="card-head">
          <span class="card-no">01</span>
          <div>
            <h2>选择歌曲</h2>
            <p>支持 AAC / FLAC / M4A / MP3 / OGG / WAV 等格式，不设固定大小上限</p>
          </div>
        </div>

        <button v-if="!song" class="dropzone" type="button" @click="pickSong">
          <span class="drop-icon"><Icon name="upload" :size="25" /></span>
          <b>点击选择音频文件</b>
          <span class="drop-sub">从手机文件中选择一首歌</span>
        </button>

        <div v-else class="song-file">
          <div class="song-icon">
            <Icon name="file" :size="20" />
          </div>
          <div class="song-info">
            <b>{{ song.name }}</b>
            <span>{{ formatBytes(song.size) }} · {{ songUploading ? '正在上传到电脑…' : songUpload ? '已上传' : songError ? '上传失败' : '待上传' }}</span>
            <div v-if="songUploading || songPct > 0" class="upload-track">
              <i :style="{ width: `${songPct}%` }" :class="{ failed: Boolean(songError) }"></i>
            </div>
            <span v-if="songError" class="song-error">{{ songError }}</span>
          </div>
          <div class="song-actions">
            <button
              v-if="!songUploading && !songUpload"
              class="mini-action"
              type="button"
              @click="uploadSong"
            >
              重试
            </button>
            <button class="mini-action danger" type="button" :disabled="songUploading" @click="removeSong">
              <Icon name="trash" :size="14" />
            </button>
          </div>
          <span v-if="songUpload && !songUploading" class="upload-ok">
            <Icon name="check" :size="12" :stroke-width="3" />
          </span>
        </div>

        <button v-if="song" class="replace" type="button" :disabled="songUploading" @click="pickSong">
          重新选择文件
        </button>

        <button class="library-pick" type="button" :disabled="songUploading" @click="openLibrary">
          <Icon name="folder" :size="15" />
          从已下载素材选择
        </button>
      </section>

      <section class="glass create-card">
        <div class="card-head">
          <span class="card-no">02</span>
          <div>
            <h2>选择声音模型</h2>
            <p>{{ models.voices.length }} 个可用模型 · 来自电脑端模型库</p>
          </div>
          <button class="refresh-mini" type="button" @click="models.loadVoices()">
            <Icon name="refresh" :size="14" />
          </button>
        </div>

        <div class="segmented mode-seg">
          <button :class="{ on: mode === 'single' }" type="button" @click="mode = 'single'">{{ t('create.single') }}</button>
          <button :class="{ on: mode === 'multi' }" type="button" @click="mode = 'multi'">{{ t('create.multi') }}</button>
        </div>
        <p class="mode-hint">
          {{
            mode === 'single'
              ? '整首歌使用一个声音模型，适合大多数翻唱。'
              : '选择 2 个以上模型并划分演唱区间，可做对唱或合唱。'
          }}
        </p>

        <div v-if="models.voicesLoading && !models.voices.length" class="model-skeleton">
          <div v-for="n in 3" :key="n" class="skeleton" style="height: 46px"></div>
        </div>

        <div v-else-if="models.voices.length" class="model-list">
          <button
            v-for="model in models.voices"
            :key="model.id"
            class="model-row"
            :class="{ on: isModelSelected(model.id) }"
            type="button"
            @click="selectModel(model.id)"
          >
            <span class="model-radio" :class="{ checkbox: mode === 'multi' }"><span></span></span>
            <span class="model-main">
              <b>{{ model.name }}</b>
              <span>
                {{ formatFramework(model.framework) }}
                <template v-if="model.sample_rate"> · {{ model.sample_rate }}</template>
                <template v-if="model.size"> · {{ model.size }}</template>
              </span>
            </span>
            <span v-if="model.id === models.defaultId" class="model-tag">默认</span>
            <span v-else-if="model.favorite" class="model-tag fav">收藏</span>
          </button>
        </div>

        <div v-else class="model-empty">
          <Icon name="mic" :size="24" />
          <b>电脑端还没有可用模型</b>
          <p>请先在电脑端「模型站」导入 SVC / RVC / SeedVC 模型，再回到这里刷新。</p>
          <button class="btn btn--sm" type="button" @click="models.loadVoices()">重新读取</button>
        </div>

        <template v-if="mode === 'multi'">
          <p v-if="selectedModels.length < 2" class="multi-hint">
            <Icon name="info" :size="12" />
            至少选择 2 个模型才能划分演唱分段。
          </p>
          <SegmentEditor
            v-else
            :models="selectedModels"
            :duration="duration"
            :segments="segments"
            @update:segments="onSegmentsUpdate"
          />

          <div class="lyric-box">
            <div class="lyric-head">
              <b>歌词时间轴</b>
              <span>可选 · 自动填歌名并生成分段</span>
            </div>
            <div class="lyric-search">
              <input
                v-model="songName"
                class="input lyric-query"
                type="text"
                placeholder="歌曲名 / 歌手"
                @keyup.enter="searchLyrics"
              />
              <select v-model="lyricSource" class="select lyric-source">
                <option v-for="source in lyricSources" :key="source.id" :value="source.id">
                  {{ source.name }}
                </option>
              </select>
              <button class="btn btn--sm btn--primary lyric-btn" type="button" :disabled="lyricLoading" @click="searchLyrics">
                <span v-if="lyricLoading" class="spinner dark"></span>
                <Icon v-else name="search" :size="13" />
                获取
              </button>
            </div>
            <p class="lyric-tip">
              上传歌曲后会自动填入歌名；也可手动输入后从曲库获取时间轴歌词。
            </p>

            <div v-if="lyricResults.length > 1 && !lyricSelected" class="lyric-candidates">
              <button
                v-for="song in lyricResults"
                :key="`${song.n}-${song.name}-${song.singer}`"
                class="lyric-candidate"
                type="button"
                @click="chooseLyric(song)"
              >
                <b>{{ song.name }}</b>
                <span>{{ song.singer }}<template v-if="song.album"> · {{ song.album }}</template></span>
                <Icon name="chevron" :size="13" />
              </button>
            </div>

            <div v-if="lyricSelected" class="lyric-status">
              <Icon name="check" :size="13" :stroke-width="3" />
              <span>
                已载入 {{ lyricLines.length }} 句歌词 · 已生成 {{ segments.length }} 段
              </span>
              <button class="mini-link" type="button" @click="buildSegmentsFromLyrics">重新分段</button>
            </div>
            <p v-if="lyricError" class="lyric-error">{{ lyricError }}</p>
          </div>
        </template>
      </section>

      <section class="glass create-card">
        <div class="card-head">
          <span class="card-no">03</span>
          <div>
            <h2>生成设置</h2>
            <p>默认参数适合大多数歌曲，可按需微调</p>
          </div>
        </div>

        <div class="field">
          <label class="field-label" for="title">作品标题</label>
          <input
            id="title"
            v-model="title"
            class="input"
            type="text"
            maxlength="120"
            placeholder="留空则使用源文件名"
          />
        </div>

        <div class="setting-block">
          <div class="setting-head">
            <div>
              <b>音高偏移</b>
              <span>半音，男声↔女声常用 ±12</span>
            </div>
            <span class="pitch-value mono">{{ pitch > 0 ? `+${pitch}` : pitch }}</span>
          </div>
          <div class="pitch-row">
            <button class="pitch-step" type="button" @click="stepPitch(-1)">−</button>
            <input
              v-model.number="pitch"
              class="pitch-range"
              type="range"
              min="-12"
              max="12"
              step="1"
              :style="{ '--pitch-progress': `${((pitch + 12) / 24) * 100}%` }"
            />
            <button class="pitch-step" type="button" @click="stepPitch(1)">+</button>
            <button class="pitch-reset" type="button" @click="resetPitch">归零</button>
          </div>
        </div>

        <div v-if="!needsReference" class="setting-block">
          <div class="setting-head">
            <div>
              <b>F0 提取算法</b>
              <span>RMVPE 在多数场景表现稳定</span>
            </div>
          </div>
          <div class="chips">
            <button
              v-for="method in f0Options"
              :key="method"
              class="chip"
              :class="{ on: f0 === method }"
              type="button"
              @click="f0 = method"
            >
              {{ method.toUpperCase() }}
            </button>
          </div>
        </div>

        <div class="setting-block">
          <div class="setting-head">
            <div>
              <b>高音保护</b>
              <span>对超出可靠音域的高音局部降调再还原</span>
            </div>
            <button class="switch" :class="{ on: guard }" type="button" @click="guard = !guard"></button>
          </div>
        </div>

        <button class="advanced-toggle" type="button" @click="modelParamsOpen = !modelParamsOpen">
          <Icon name="sliders" :size="14" />
          模型专用参数
          <span class="adv-tag">{{ formatFramework(primaryFramework) }}</span>
          <Icon :name="modelParamsOpen ? 'chevron-down' : 'chevron'" :size="13" class="adv-arrow" />
        </button>

        <div v-if="modelParamsOpen" class="advanced-body">
          <ModelParamsPanel :framework="primaryFramework" :params="modelParams" />
        </div>

        <div v-if="needsReference" class="setting-block">
          <div class="setting-head">
            <div>
              <b>目标音色参考音频</b>
              <span>SeedVC 必填，10~30 秒干净人声最佳</span>
            </div>
          </div>
          <button v-if="!reference" class="ref-pick" type="button" :disabled="referenceUploading" @click="pickReference">
            <Icon name="upload" :size="16" />
            {{ referenceUploading ? '正在上传…' : '选择参考音频' }}
          </button>
          <div v-else class="ref-file">
            <Icon name="mic" :size="15" />
            <div class="grow">
              <b class="truncate">{{ reference.name }}</b>
              <span>{{ referenceUpload ? '已上传' : referenceError || '等待上传' }} · {{ formatBytes(reference.size) }}</span>
              <div v-if="referenceUploading" class="upload-track">
                <i :style="{ width: `${referencePct}%` }"></i>
              </div>
            </div>
            <button class="mini-action danger" type="button" :disabled="referenceUploading" @click="removeReference">
              <Icon name="close" :size="13" />
            </button>
          </div>
        </div>
      </section>

      <section class="glass create-card">
        <div class="card-head">
          <span class="card-no">04</span>
          <div>
            <h2>前处理与后期</h2>
            <p>手机端只保留常用开关，精细编辑请回电脑端</p>
          </div>
        </div>

        <div class="setting-block">
          <div class="setting-head">
            <div>
              <b>人声分离</b>
              <span>推理前先分离人声和伴奏</span>
            </div>
            <button
              class="switch"
              :class="{ on: preprocessEnabled }"
              type="button"
              @click="preprocessEnabled = !preprocessEnabled"
            ></button>
          </div>

          <template v-if="preprocessEnabled">
            <div class="segmented engine-seg">
              <button :class="{ on: engine === 'uvr' }" type="button" @click="engine = 'uvr'">UVR</button>
              <button :class="{ on: engine === 'pymss' }" type="button" @click="engine = 'pymss'">PyMSS</button>
            </div>

            <div v-if="engine === 'pymss'" class="sub-setting">
              <PymssModelPicker v-model="pymssModel" :models="pymssReady" />
            </div>

            <div v-if="engine === 'pymss'" class="setting-head compact">
              <div>
                <b>去混响 / 人声净化</b>
                <span>降低房间反射与残响，需要 PyMSS 去混响模型</span>
              </div>
              <button class="switch" :class="{ on: harmony }" type="button" @click="harmony = !harmony"></button>
            </div>

            <div v-if="engine === 'pymss' && harmony" class="sub-setting">
              <label class="field-label" for="harmony-model">去混响模型</label>
              <select v-if="dereverbReady.length" id="harmony-model" v-model="harmonyModel" class="select">
                <option v-for="item in dereverbReady" :key="item.name" :value="item.name">
                  {{ item.name }} · {{ item.category_label || '去混响' }}
                </option>
              </select>
              <div v-else class="inline-hint warn">
                <Icon name="info" :size="13" />
                还没有已下载的 PyMSS 去混响模型，去混响会在电脑端失败。
              </div>
            </div>
          </template>
        </div>

        <div class="setting-block">
          <div class="setting-head">
            <div>
              <b>AI 美声</b>
              <span>修音、对齐与轻母带，提升成品完整度</span>
            </div>
            <button
              class="switch"
              :class="{ on: aiParams.enabled }"
              type="button"
              @click="aiParams.enabled = !aiParams.enabled"
            ></button>
          </div>
          <AiParamsPanel v-if="aiParams.enabled" :params="aiParams" />
        </div>

        <button class="advanced-toggle" type="button" @click="advancedOpen = !advancedOpen">
          <Icon name="sliders" :size="14" />
          高级参数
          <Icon :name="advancedOpen ? 'chevron-down' : 'chevron'" :size="13" class="adv-arrow" />
        </button>

        <div v-if="advancedOpen" class="advanced-body">
          <label class="field-label">推理设备</label>
          <div class="chips scroll-x">
            <button
              v-for="option in deviceOptions"
              :key="option.value"
              class="chip"
              :class="{ on: device === option.value }"
              type="button"
              :disabled="option.disabled"
              :title="option.name || undefined"
              @click="device = option.value"
            >
              {{ option.label }}
            </button>
          </div>
          <p class="inline-hint" :class="{ warn: !config.system?.inference_devices?.options?.length }">
            <Icon name="info" :size="12" />
            {{ deviceHint }}
          </p>
        </div>
      </section>

      <p class="bottom-note">
        多模型混唱、时间轴编排、音频编辑与自定义工作流仍由电脑端负责。
      </p>
    </div>

    <footer class="create-foot">
      <div class="foot-info">
        <span class="foot-kicker">// READY</span>
        <b class="truncate">{{ summary }}</b>
        <span v-if="blockReason" class="block-reason">{{ blockReason }}</span>
        <span v-else class="foot-ok">已就绪，任务将进入电脑端队列</span>
      </div>
      <button class="submit" type="button" :disabled="!canSubmit" @click="submit">
        <span v-if="submitting" class="spinner dark"></span>
        <Icon v-else name="sparkles" :size="17" />
        {{ submitting ? '正在创建…' : '开始生成' }}
      </button>
    </footer>

    <DownloadedMusicSheet
      v-if="libraryOpen"
      @close="libraryOpen = false"
      @select="useLibrary"
    />
  </div>
</template>

<style scoped>
.create-page {
  display: flex;
  flex-direction: column;
  min-height: 100%;
}

.create-head {
  position: sticky;
  top: 0;
  z-index: 15;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: calc(10px + env(safe-area-inset-top)) 16px 10px;
  background: linear-gradient(180deg, rgba(var(--xb-bg-rgb), 0.97), rgba(var(--xb-bg-rgb), 0.72));
  border-bottom: 1px solid var(--xb-border);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
}

.head-text {
  flex: 1 1 auto;
  min-width: 0;
}

.head-text h1 {
  margin-top: 3px;
  font-size: 19px;
  font-weight: 800;
  letter-spacing: -0.4px;
}

.head-tag {
  padding: 4px 9px;
  border: 1px solid rgba(var(--xb-primary-rgb), 0.32);
  border-radius: 999px;
  background: rgba(var(--xb-primary-rgb), 0.08);
  color: var(--xb-primary);
  font-size: 10px;
  font-weight: 700;
  white-space: nowrap;
}

.create-body {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px 16px calc(126px + env(safe-area-inset-bottom));
}

.intro {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 2px 2px 0;
  color: var(--xb-muted);
  font-size: 10.5px;
  line-height: 1.5;
}

.intro .wave-bars {
  height: 18px;
}

.intro .wave-bars i {
  width: 2px;
  animation-duration: 1.4s;
}

.create-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px;
}

.card-head {
  display: flex;
  align-items: flex-start;
  gap: 9px;
}

.card-no {
  display: grid;
  place-items: center;
  flex: none;
  width: 24px;
  height: 24px;
  border: 1px solid rgba(var(--xb-primary-rgb), 0.4);
  border-radius: 8px;
  color: var(--xb-primary);
  font: 800 10px/1 ui-monospace, 'Cascadia Mono', Menlo, Consolas, monospace;
}

.card-head h2 {
  font-size: 13.5px;
  font-weight: 800;
  line-height: 1.3;
}

.card-head p {
  margin-top: 2px;
  color: var(--xb-muted);
  font-size: 9.5px;
  line-height: 1.5;
}

.card-head > div {
  flex: 1 1 auto;
}

.refresh-mini {
  display: grid;
  place-items: center;
  flex: none;
  width: 28px;
  height: 28px;
  border: 1px solid var(--xb-border);
  border-radius: 9px;
  color: var(--xb-muted);
}

.dropzone {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 20px 12px;
  border: 1.5px dashed rgba(var(--xb-primary-rgb), 0.34);
  border-radius: 14px;
  background: rgba(var(--xb-primary-rgb), 0.035);
  color: var(--xb-text);
}

.dropzone:active {
  border-color: var(--xb-primary);
  background: rgba(var(--xb-primary-rgb), 0.08);
}

.drop-icon {
  display: grid;
  place-items: center;
  width: 46px;
  height: 46px;
  margin-bottom: 3px;
  border-radius: 15px;
  background: rgba(var(--xb-primary-rgb), 0.1);
  color: var(--xb-primary);
}

.dropzone b {
  font-size: 12.5px;
}

.drop-sub {
  color: var(--xb-muted);
  font-size: 9.5px;
}

.song-file {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px;
  border: 1px solid rgba(var(--xb-primary-rgb), 0.28);
  border-radius: 13px;
  background: rgba(var(--xb-primary-rgb), 0.045);
}

.song-icon {
  display: grid;
  place-items: center;
  flex: none;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: rgba(var(--xb-primary-rgb), 0.12);
  color: var(--xb-primary);
}

.song-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1 1 auto;
}

.song-info b {
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.song-info > span {
  color: var(--xb-muted);
  font-size: 9px;
}

.song-info .song-error {
  color: var(--xb-danger);
}

.upload-track {
  height: 4px;
  margin-top: 4px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(var(--xb-fill-rgb), 0.1);
}

.upload-track i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--xb-brand-gradient);
  transition: width 0.3s ease;
}

.upload-track i.failed {
  background: var(--xb-danger);
}

.song-actions {
  display: flex;
  align-items: center;
  gap: 5px;
  flex: none;
}

.mini-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 30px;
  height: 30px;
  padding: 0 8px;
  border: 1px solid var(--xb-border);
  border-radius: 9px;
  color: var(--xb-muted);
  font-size: 10px;
  font-weight: 700;
}

.mini-action.danger {
  color: var(--xb-danger);
  border-color: rgba(var(--xb-danger-rgb), 0.3);
}

.upload-ok {
  position: absolute;
  top: -5px;
  right: -5px;
  display: grid;
  place-items: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--xb-success);
  color: var(--xb-bg);
}

.replace {
  align-self: flex-start;
  color: var(--xb-primary);
  font-size: 10.5px;
  font-weight: 700;
}

.library-pick {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  min-height: 38px;
  border: 1px dashed rgba(var(--xb-primary-rgb), 0.32);
  border-radius: 11px;
  background: rgba(var(--xb-primary-rgb), 0.035);
  color: var(--xb-primary);
  font-size: 10.5px;
  font-weight: 700;
}

.library-pick:active:not(:disabled) {
  border-color: var(--xb-primary);
  background: rgba(var(--xb-primary-rgb), 0.08);
}

.library-pick:disabled {
  opacity: 0.45;
}

.lyric-box {
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding-top: 10px;
  border-top: 1px dashed var(--xb-border);
}

.lyric-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.lyric-head b {
  font-size: 11px;
}

.lyric-head span {
  color: var(--xb-muted);
  font-size: 8.5px;
  text-align: right;
}

.lyric-search {
  display: flex;
  align-items: center;
  gap: 6px;
}

.lyric-query {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 36px;
  padding: 6px 9px;
  font-size: 11px;
}

.lyric-source {
  flex: 0 0 92px;
  width: 92px;
  min-height: 36px;
  padding: 4px 6px;
  font-size: 10px;
}

.lyric-btn {
  flex: none;
  min-height: 36px;
  padding: 0 10px;
}

.lyric-tip {
  color: var(--xb-muted);
  font-size: 8.5px;
  line-height: 1.5;
}

.lyric-candidates {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 176px;
  overflow-y: auto;
}

.lyric-candidate {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1px;
  padding: 7px 24px 7px 8px;
  border: 1px solid var(--xb-border);
  border-radius: 8px;
  background: rgba(var(--xb-fill-rgb), 0.025);
  text-align: left;
}

.lyric-candidate b {
  font-size: 10.5px;
}

.lyric-candidate span {
  color: var(--xb-muted);
  font-size: 8.5px;
}

.lyric-candidate :deep(svg) {
  position: absolute;
  top: 50%;
  right: 8px;
  transform: translateY(-50%);
  color: var(--xb-muted);
}

.lyric-status {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 5px;
  padding: 7px 8px;
  border: 1px solid rgba(var(--xb-success-rgb), 0.28);
  border-radius: 8px;
  background: rgba(var(--xb-success-rgb), 0.06);
  color: var(--xb-success);
  font-size: 9px;
}

.mini-link {
  margin-left: auto;
  color: var(--xb-primary);
  font-size: 9px;
  font-weight: 700;
}

.lyric-error {
  color: var(--xb-danger);
  font-size: 9px;
  line-height: 1.5;
}

.chip:disabled {
  opacity: 0.35;
}

.model-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 268px;
  overflow-y: auto;
  padding-right: 2px;
  scrollbar-width: thin;
}

.mode-seg {
  margin-top: -2px;
}

.mode-hint {
  color: var(--xb-muted);
  font-size: 9.5px;
  line-height: 1.5;
}

.multi-hint {
  display: flex;
  align-items: flex-start;
  gap: 5px;
  padding: 8px 9px;
  border: 1px solid rgba(var(--xb-warn-rgb), 0.3);
  border-radius: 9px;
  background: rgba(var(--xb-warn-rgb), 0.06);
  color: var(--xb-warn);
  font-size: 9.5px;
  line-height: 1.5;
}

.model-radio.checkbox {
  border-radius: 4px;
}

.model-row.on .model-radio.checkbox span {
  width: 8px;
  height: 8px;
  border-radius: 2px;
}

.adv-tag {
  margin-left: 4px;
  padding: 1px 5px;
  border: 1px solid var(--xb-border);
  border-radius: 5px;
  color: var(--xb-muted);
  font-size: 8px;
  font-weight: 600;
}

.model-skeleton {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.model-row {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 9px 10px;
  border: 1px solid var(--xb-border);
  border-radius: 12px;
  background: rgba(var(--xb-fill-rgb), 0.02);
  text-align: left;
}

.model-row.on {
  border-color: rgba(var(--xb-primary-rgb), 0.55);
  background: rgba(var(--xb-primary-rgb), 0.08);
  box-shadow: inset 2px 0 0 var(--xb-primary);
}

.model-radio {
  display: grid;
  place-items: center;
  flex: none;
  width: 16px;
  height: 16px;
  border: 1.5px solid var(--xb-border-strong);
  border-radius: 50%;
}

.model-row.on .model-radio {
  border-color: var(--xb-primary);
}

.model-row.on .model-radio span {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--xb-primary);
  box-shadow: 0 0 8px rgba(var(--xb-primary-rgb), 0.7);
}

.model-main {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
  flex: 1 1 auto;
}

.model-main b {
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.model-main span {
  color: var(--xb-muted);
  font-size: 9px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.model-tag {
  flex: none;
  padding: 2px 6px;
  border: 1px solid rgba(var(--xb-primary-rgb), 0.3);
  border-radius: 999px;
  color: var(--xb-primary);
  font-size: 9px;
  font-weight: 700;
}

.model-tag.fav {
  color: var(--xb-warn);
  border-color: rgba(var(--xb-warn-rgb), 0.35);
}

.model-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 16px 10px;
  color: var(--xb-muted);
  text-align: center;
}

.model-empty b {
  color: var(--xb-text);
  font-size: 12px;
}

.model-empty p {
  max-width: 250px;
  font-size: 9.5px;
  line-height: 1.55;
}

.setting-block {
  display: flex;
  flex-direction: column;
  gap: 9px;
  padding-top: 11px;
  border-top: 1px dashed var(--xb-border);
}

.setting-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.setting-head > div {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.setting-head b {
  font-size: 12px;
}

.setting-head span {
  color: var(--xb-muted);
  font-size: 9.5px;
  line-height: 1.5;
}

.setting-head.compact {
  margin-top: 2px;
}

.pitch-value {
  color: var(--xb-primary);
  font-size: 20px;
  font-weight: 800;
  min-width: 40px;
  text-align: right;
}

.pitch-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pitch-step {
  display: grid;
  place-items: center;
  flex: none;
  width: 32px;
  height: 32px;
  border: 1px solid var(--xb-border);
  border-radius: 9px;
  color: var(--xb-text);
  font-size: 16px;
  font-weight: 700;
}

.pitch-step:active {
  border-color: var(--xb-primary);
  color: var(--xb-primary);
}

.pitch-range {
  flex: 1 1 auto;
  min-width: 0;
  height: 24px;
  appearance: none;
  -webkit-appearance: none;
  background: transparent;
}

.pitch-range::-webkit-slider-runnable-track {
  height: 4px;
  border-radius: 999px;
  background: linear-gradient(
    90deg,
    rgba(var(--xb-primary-rgb), 0.7) var(--pitch-progress),
    rgba(var(--xb-fill-rgb), 0.14) var(--pitch-progress)
  );
}

.pitch-range::-webkit-slider-thumb {
  width: 15px;
  height: 15px;
  margin-top: -5.5px;
  appearance: none;
  -webkit-appearance: none;
  border: 2px solid var(--xb-bg-2);
  border-radius: 50%;
  background: var(--xb-primary);
  box-shadow: 0 0 10px rgba(var(--xb-primary-rgb), 0.6);
}

.pitch-reset {
  flex: none;
  color: var(--xb-muted);
  font-size: 10px;
  font-weight: 700;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.chips.scroll-x {
  flex-wrap: nowrap;
  overflow-x: auto;
  scrollbar-width: none;
}

.chips.scroll-x::-webkit-scrollbar {
  display: none;
}

.chip {
  flex: none;
  height: 30px;
  padding: 0 11px;
  border: 1px solid var(--xb-border);
  border-radius: 999px;
  background: rgba(var(--xb-fill-rgb), 0.03);
  color: var(--xb-muted);
  font-size: 10px;
  font-weight: 700;
}

.chip.on {
  border-color: rgba(var(--xb-primary-rgb), 0.55);
  background: rgba(var(--xb-primary-rgb), 0.1);
  color: var(--xb-primary);
}

.engine-seg {
  margin-top: 1px;
}

.sub-setting {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.inline-hint {
  display: flex;
  align-items: flex-start;
  gap: 5px;
  color: var(--xb-muted);
  font-size: 9.5px;
  line-height: 1.55;
}

.inline-hint.warn {
  padding: 8px 9px;
  border: 1px solid rgba(var(--xb-warn-rgb), 0.3);
  border-radius: 9px;
  background: rgba(var(--xb-warn-rgb), 0.06);
  color: var(--xb-warn);
}

.ref-pick {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 40px;
  border: 1px dashed rgba(var(--xb-primary-rgb), 0.35);
  border-radius: 11px;
  background: rgba(var(--xb-primary-rgb), 0.04);
  color: var(--xb-primary);
  font-size: 11px;
  font-weight: 700;
}

.ref-file {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px;
  border: 1px solid var(--xb-border);
  border-radius: 11px;
  color: var(--xb-primary);
}

.ref-file .grow {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.ref-file b {
  color: var(--xb-text);
  font-size: 11px;
}

.ref-file span {
  color: var(--xb-muted);
  font-size: 9px;
}

.advanced-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  align-self: flex-start;
  padding-top: 11px;
  border-top: 1px dashed var(--xb-border);
  width: 100%;
  color: var(--xb-muted);
  font-size: 11px;
  font-weight: 700;
}

.adv-arrow {
  margin-left: auto;
}

.advanced-body {
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding: 9px;
  border: 1px solid var(--xb-border);
  border-radius: 11px;
  background: rgba(var(--xb-fill-rgb), 0.02);
}

.bottom-note {
  padding: 0 4px;
  color: var(--xb-muted);
  font-size: 9.5px;
  line-height: 1.6;
  text-align: center;
  opacity: 0.8;
}

.create-foot {
  position: fixed;
  left: 50%;
  bottom: 0;
  z-index: 25;
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  max-width: 560px;
  padding: 10px 16px calc(10px + env(safe-area-inset-bottom));
  border-top: 1px solid var(--xb-border);
  background: linear-gradient(0deg, rgba(var(--xb-bg-rgb), 0.99), rgba(var(--xb-bg-rgb), 0.9));
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  transform: translateX(-50%);
}

.foot-info {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
  flex: 1 1 auto;
}

.foot-kicker {
  color: var(--xb-primary);
  font: 700 8px/1.2 ui-monospace, 'Cascadia Mono', Menlo, Consolas, monospace;
  letter-spacing: 1.3px;
}

.foot-info b {
  font-size: 12px;
  font-weight: 800;
}

.block-reason {
  color: var(--xb-warn);
  font-size: 9px;
  line-height: 1.4;
}

.foot-ok {
  color: var(--xb-success);
  font-size: 9px;
}

.submit {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  flex: none;
  min-width: 118px;
  height: 46px;
  padding: 0 16px;
  border-radius: 14px;
  background: var(--xb-brand-gradient);
  color: var(--xb-on-primary);
  font-size: 13px;
  font-weight: 800;
  box-shadow: 0 10px 26px rgba(var(--xb-primary-rgb), 0.3);
}

.submit:disabled {
  opacity: 0.4;
  box-shadow: none;
}

.submit:active:not(:disabled) {
  transform: scale(0.97);
}

.submit .spinner.dark {
  border-color: rgba(0, 0, 0, 0.2);
  border-top-color: var(--xb-on-primary);
}
</style>
