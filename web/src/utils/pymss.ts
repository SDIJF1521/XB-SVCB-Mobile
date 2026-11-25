import type { PymssModel } from '@/api/types'

const FORBIDDEN_STEMS = [
  'male',
  'female',
  'speech',
  'speaker',
  'dialog',
  'duet',
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
 * 与电脑端封面制作保持一致：只接受能够提供人声（以及可选伴奏）的分离模型。
 *
 * 目录里的 purpose 并不总是可靠：像 instvox_duality 这类双向模型，
 * 分类可能不在桌面的 vocal_extraction 白名单里，purpose 为空，但它的
 * target_stems 明确是 vocals/instrumental。这里优先相信目标音轨，
 * purpose 仅作为没有音轨元数据时的回退；双人/二重唱、合唱、男女声、
 * 语音、多轨、单乐器模型仍排除，卡拉OK/和声的 backing_vocal 模型允许。
 */
export function isCoverSeparationModel(model: PymssModel): boolean {
  const explicitPurpose = String(model.purpose || '').toLowerCase()
  if (explicitPurpose === 'dereverb' || explicitPurpose === 'harmony_removal') return false

  const stems = normalizeStems(model)
  const name = model.name.toLowerCase()
  const nameLooksUnsafe =
    /(^|[^a-z0-9])(inst|instrumental|multi|speech|speaker|male|female|duet|guitar|bass|drum|piano)([^a-z0-9]|$)/i.test(
      name,
    )
  const hasVocal = stems.some((stem) => /vocal|voice|人声/.test(stem))
  const hasAccompaniment = stems.some((stem) =>
    /instrument|accompani|inst$|伴奏/.test(stem),
  )
  const isInstVox = /instvox|inst_vox|instrumental[_-]?vocal|duality/i.test(name)
  const description = [
    model.category_label,
    model.primary_category_label,
    model.secondary_category_label,
    model.purpose_label,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  const descriptionLooksUnsafe =
    /双人|二重唱|对唱|合唱|男女声|男声|女声|语音|说话|多轨|单乐器|混响|回声|duet|duo|chorus|male.?female|speech|speaker|multi|instrument|guitar|bass|drum|piano|reverb|echo|dereverb|deecho|denoise/i.test(
      description,
    )

  // 分类名明确是双人/二重唱、合唱、男女声、语音或多轨/单乐器时，
  // 即使 target_stems 只有 vocals 也不是整曲翻唱可用的人声分离模型。
  // 卡拉OK/和声的 backing_vocal 模型仍允许。
  if (descriptionLooksUnsafe) return false
  if (nameLooksUnsafe && !isInstVox) return false

  if (!stems.length) {
    // 旧目录或精简接口没有目标音轨时，保留桌面的用途判断；
    // 但文件名明显是纯伴奏/多轨/语音时不要放进来。
    return explicitPurpose === 'vocal_separation'
  }
  if (stems.length > 2) return false
  if (!hasVocal) return false
  if (stems.some((stem) => FORBIDDEN_STEMS.some((word) => stem.includes(word)))) return false

  // 音轨已明确包含人声时，优先相信音轨；instvox / inst_vox 这类
  // 双向模型不能因为文件名带 inst 就被误杀。
  if (stems.length === 1) return true
  return hasAccompaniment
}

export function coverSeparationModels(models: PymssModel[]): PymssModel[] {
  return models.filter((model) => model.downloaded && isCoverSeparationModel(model))
}
