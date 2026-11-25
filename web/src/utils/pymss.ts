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
 * 与电脑端封面制作保持一致：只接受能够提供人声（以及可选伴奏）的分离模型。
 *
 * 目录里的 purpose 并不总是可靠：像 instvox_duality 这类双向模型，
 * 分类可能不在桌面的 vocal_extraction 白名单里，purpose 为空，但它的
 * target_stems 明确是 vocals/instrumental。这里优先相信目标音轨，
 * purpose 仅作为没有音轨元数据时的回退。
 */
export function isCoverSeparationModel(model: PymssModel): boolean {
  if (model.purpose === 'dereverb' || model.purpose === 'harmony_removal') return false

  const stems = normalizeStems(model)
  const name = model.name.toLowerCase()
  const nameLooksUnsafe =
    /(^|[_-])(inst|instrumental|karaoke|multi|speech|speaker|male|female|duet|guitar|bass|drum|piano)([_-]|$)/i.test(
      name,
    )
  const hasVocal = stems.some((stem) => /vocal|voice|人声/.test(stem))
  const hasAccompaniment = stems.some((stem) =>
    /instrument|accompani|inst$|伴奏/.test(stem),
  )
  const isInstVox = /instvox|inst_vox|instrumental[_-]?vocal|duality/i.test(name)

  // 纯伴奏/多轨/语音模型即使目录元数据误标，也不能进入翻唱。
  // instvox / inst_vox / duality 这类“人声-伴奏双向”命名例外。
  if (nameLooksUnsafe && !isInstVox) return false

  if (!stems.length) {
    // 旧目录或精简接口没有目标音轨时，保留桌面的用途判断；
    // 但文件名明显是纯伴奏/多轨/语音时不要放进来。
    return model.purpose === 'vocal_separation'
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
