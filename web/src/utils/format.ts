/**
 * 展示层格式化工具。
 * 时间与体积的显示方式贴近桌面端，避免同一个作品在两个端出现不同口径。
 */

import { locale, t } from '@/i18n'

/** 统一把旧版电脑端的 404 变成可操作的提示。 */
export function apiErrorMessage(error: unknown, fallback = '请求失败'): string {
  const message = error instanceof Error ? error.message : fallback
  if (
    message === 'Not Found' ||
    message === '资源不存在' ||
    message.includes('HTTP 404') ||
    message.includes('404')
  ) {
    return '电脑端 API 版本过旧，缺少素材/歌词接口。请更新后端代码并重启 API 服务。'
  }
  return message
}

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return '—'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value.toFixed(value >= 100 || unit === 0 ? 0 : 1)} ${units[unit]}`
}

export function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatDateTime(value: string | null | undefined): string {
  const date = parseDate(value)
  if (!date) return '—'
  try {
    // 跟随应用内语言，而不是浏览器系统区域。
    return new Intl.DateTimeFormat(locale.value, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date)
  } catch {
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
  }
}

export function relativeTime(value: string | null | undefined): string {
  const date = parseDate(value)
  if (!date) return '—'
  const diffSeconds = (date.getTime() - Date.now()) / 1000
  if (diffSeconds > -60) return locale.value === 'zh-CN' ? '刚刚' : 'just now'
  try {
    const formatter = new Intl.RelativeTimeFormat(locale.value, { numeric: 'auto' })
    const absolute = Math.abs(diffSeconds)
    if (absolute < 3600) return formatter.format(Math.round(diffSeconds / 60), 'minute')
    if (absolute < 86400) return formatter.format(Math.round(diffSeconds / 3600), 'hour')
    if (absolute < 86400 * 7) return formatter.format(Math.round(diffSeconds / 86400), 'day')
  } catch {
    // 回退到固定格式。
  }
  return formatDateTime(value)
}

/** 去掉文件名非法字符，保留中文与空格。 */
export function safeFilename(value: string, fallback = 'cover'): string {
  const cleaned = value
    .replace(/[\\/:*?"<>|\r\n\t]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return (cleaned || fallback).slice(0, 80)
}

export function formatFramework(framework: string | null | undefined): string {
  switch (framework) {
    case 'so-vits-svc':
      return 'So-VITS-SVC'
    case 'rvc':
      return 'RVC'
    case 'seed-vc':
      return 'SeedVC'
    case 'ddsp-svc':
      return 'DDSP-SVC'
    default:
      return framework || '未知框架'
  }
}

export function jobStatusLabel(status: string): string {
  switch (status) {
    case 'queue':
      return t('job.queue')
    case 'running':
      return t('job.running')
    case 'done':
      return t('job.done')
    case 'failed':
      return t('job.failed')
    default:
      return status
  }
}

export function stemLabel(stem: string): string {
  switch (stem) {
    case 'output':
    case 'instrumental':
    case 'vocals':
      return t(`stem.${stem}`)
    default:
      return stem
  }
}

const STEP_KEYS: Record<string, string> = {
  人声分离: 'step.separate',
  声音转换: 'step.convert',
  'AI 增强': 'step.enhance',
  混音导出: 'step.mix',
  'F0 分析': 'step.f0',
  模型推理: 'step.infer',
  去混响: 'step.dereverb',
}

/** 后端返回中文步骤名，这里按固定词表翻译，未知步骤保持原样。 */
export function stepLabel(label: string): string {
  const key = STEP_KEYS[label]
  return key ? t(key) : label
}

export function truncate(value: string, max = 48): string {
  return value.length > max ? `${value.slice(0, max)}…` : value
}

/** 从文件名推导作品标题，去掉扩展名与首尾空白。 */
export function titleFromFilename(filename: string): string {
  return filename.replace(/\.[^./\\]+$/, '').trim() || '未命名翻唱'
}
