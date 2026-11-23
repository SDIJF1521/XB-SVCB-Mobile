import type { PymssModel } from '@/api/types'

const FORBIDDEN_STEMS = [
  'male',
  'female',
  'speech',
  'speaker',
  'dialog',
  'duet',
  'harmony',
  'karaoke',
  'bass',
  'drum',
  'guitar',
  'piano',
  'other',
  'multi',
  '男声',
  '女声',
  '语音',
  '说话',
  '和声',
  '卡拉',
  '吉他',
  '贝斯',
  '鼓',
  '钢琴',
  '多轨',
]

function normalizeStems(model: PymssModel): string[] {
  const values = model.target_stems?.length ? model.target_stems : model.stems || []
  return values
    .map((value) => String(value || '').trim().toLowerCase())
    .filter(Boolean)
}

/**
 * 与电脑端封面制作保持一致：只接受用途为人声分离、且输出包含人声的模型。
 * 多轨、单乐器、KTV/和声、男女声、语音/说话人、纯伴奏模型都会被排除。
 */
export function isCoverSeparationModel(model: PymssModel): boolean {
  if (model.purpose !== 'vocal_separation') return false
  // 目录元数据偶尔把纯伴奏/多轨模型误标为人声分离，文件名再兜底一次。
  if (
    /(^|[_-])(inst|instrumental|karaoke|multi|speech|speaker|male|female|duet|guitar|bass|drum|piano)([_-]|$)/i.test(
      model.name,
    )
  ) {
    return false
  }
  const stems = normalizeStems(model)
  if (!stems.length) return true
  if (stems.length > 2) return false

  const hasVocal = stems.some((stem) => /vocal|voice|人声/.test(stem))
  if (!hasVocal) return false
  if (stems.some((stem) => FORBIDDEN_STEMS.some((word) => stem.includes(word)))) return false

  const hasAccompaniment = stems.some((stem) =>
    /instrument|accompani|inst$|伴奏/.test(stem),
  )
  // 单轨人声提取模型可以用于翻唱；双轨模型必须同时包含人声和伴奏。
  return stems.length === 1 ? hasVocal : hasAccompaniment
}

export function coverSeparationModels(models: PymssModel[]): PymssModel[] {
  return models.filter((model) => model.downloaded && isCoverSeparationModel(model))
}
