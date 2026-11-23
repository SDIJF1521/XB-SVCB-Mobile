/** 创建翻唱时的表单状态与默认值。 */

export interface SegmentDraft {
  id: string
  start: number
  end: number
  modelIds: string[]
  /** 歌词初始分句的文本；手动分段为空。 */
  text?: string
}

export interface ModelParamsState {
  pitch: number
  f0Method: string
  device: string
  guard: boolean
  diffusionRatio: number
  speaker: string
  indexRate: number
  rmsMix: number
  protect: number
  filterRadius: number
  rvcVersion: 'v1' | 'v2' | 'v3'
  ddspSteps: number
  ddspFormant: number
  manual: boolean
  guardRounds: number
  f0Threshold: number
}

export interface AiParamsState {
  enabled: boolean
  level: 'basic' | 'advanced'
  pitchCorrection: number
  timingAlignment: number
  timbreFocus: number
  aiEq: number
  aiCompressor: number
  aiExciter: number
  stereoWidth: number
  loudnessEnvelope: number
}

export function defaultModelParams(): ModelParamsState {
  return {
    pitch: 0,
    f0Method: 'rmvpe',
    device: 'auto',
    guard: true,
    diffusionRatio: 0.5,
    speaker: '',
    indexRate: 0.75,
    rmsMix: 0.25,
    protect: 0.33,
    filterRadius: 3,
    rvcVersion: 'v2',
    ddspSteps: 50,
    ddspFormant: 0,
    manual: false,
    guardRounds: 3,
    f0Threshold: 0.05,
  }
}

export function defaultAiParams(): AiParamsState {
  return {
    enabled: false,
    level: 'basic',
    pitchCorrection: 0.45,
    timingAlignment: 0.45,
    timbreFocus: 0.6,
    aiEq: 0.55,
    aiCompressor: 0.45,
    aiExciter: 0.25,
    stereoWidth: 0.3,
    loudnessEnvelope: 0.58,
  }
}

export function newSegment(
  start: number,
  end: number,
  modelIds: string[],
  text = '',
): SegmentDraft {
  return {
    id: `seg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    start,
    end,
    modelIds,
    text,
  }
}
