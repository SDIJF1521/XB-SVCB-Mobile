/**
 * 原生能力桥。
 *
 * APK 内由 Android 端的 `XBNative` 注入同步接口，所有 HTTP、文件选择、
 * 上传与下载都走原生通道：既避免 file:// 页面的跨域限制，也能拿到真实的
 * 上传进度和系统下载通知。浏览器预览时自动回退到 fetch / XHR。
 */

export interface PickedFile {
  token: string
  name: string
  size: number
  mime: string
}

export interface SavedDownload {
  downloadId: number
  filename: string
}

export interface CachedAudio {
  path: string
  size: number
}

export interface AppInfo {
  version: string
  sdk: number
  device: string
}

export interface HttpResult<T> {
  status: number
  data: T
}

export interface StoredConfig {
  serverUrl?: string
  apiKey?: string
  downloadSubdir?: string
  lastTab?: string
}

interface NativeEnvelope {
  ok: boolean
  data?: unknown
  status?: number
  error?: string
}

interface NativeApi {
  call: (method: string, requestId: string, argsJson: string) => void
}

declare global {
  interface Window {
    XBNative?: NativeApi
    __xbNativeResult?: (id: string, ok: boolean, payload: string) => void
    __xbNativeProgress?: (id: string, pct: number, received: number, total: number) => void
  }
}

export const isNative = typeof window !== 'undefined' && Boolean(window.XBNative)

const CONFIG_KEY = 'xb-svcb.mobile.config'
const pending = new Map<string, { resolve: (value: unknown) => void; reject: (error: Error) => void }>()
const progressHandlers = new Map<string, (pct: number, received: number, total: number) => void>()
let requestSeq = 0

export class BridgeError extends Error {
  status: number

  constructor(message: string, status = 0) {
    super(message)
    this.name = 'BridgeError'
    this.status = status
  }
}

if (typeof window !== 'undefined') {
  window.__xbNativeResult = (id, ok, payload) => {
    const entry = pending.get(id)
    if (!entry) return
    pending.delete(id)
    progressHandlers.delete(id)
    let envelope: NativeEnvelope
    try {
      envelope = JSON.parse(payload) as NativeEnvelope
    } catch {
      entry.reject(new BridgeError('原生层返回了无法解析的数据'))
      return
    }
    if (!ok || !envelope.ok) {
      entry.reject(new BridgeError(envelope.error || '原生调用失败', envelope.status || 0))
      return
    }
    entry.resolve(envelope.data)
  }

  window.__xbNativeProgress = (id, pct, received, total) => {
    progressHandlers.get(id)?.(pct, received, total)
  }
}

function callNative<T>(
  method: string,
  args: Record<string, unknown> = {},
  onProgress?: (pct: number, received: number, total: number) => void,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (!window.XBNative) {
      reject(new BridgeError('当前环境不支持原生调用'))
      return
    }
    const id = `${Date.now().toString(36)}-${++requestSeq}`
    pending.set(id, { resolve: resolve as (value: unknown) => void, reject })
    if (onProgress) progressHandlers.set(id, onProgress)
    try {
      window.XBNative.call(method, id, JSON.stringify(args))
    } catch (error) {
      pending.delete(id)
      progressHandlers.delete(id)
      reject(new BridgeError(error instanceof Error ? error.message : '原生调用异常'))
    }
  })
}

/** 浏览器预览使用的隐藏文件输入。 */
const browserFiles = new Map<string, File>()

function pickInBrowser(accept: string): Promise<PickedFile> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.style.display = 'none'
    input.addEventListener('change', () => {
      const file = input.files?.[0]
      input.remove()
      if (!file) {
        reject(new BridgeError('未选择文件'))
        return
      }
      const token = `file-${Date.now()}-${Math.random().toString(36).slice(2)}`
      browserFiles.set(token, file)
      resolve({ token, name: file.name, size: file.size, mime: file.type || 'audio/*' })
    })
    input.addEventListener('cancel', () => {
      input.remove()
      reject(new BridgeError('已取消选择'))
    })
    document.body.appendChild(input)
    input.click()
  })
}

function emitToast(message: string): void {
  window.dispatchEvent(new CustomEvent('xb-toast', { detail: message }))
}

async function readResponse(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

function errorDetail(body: unknown, status: number): string {
  if (body && typeof body === 'object' && 'detail' in body) {
    const detail = (body as { detail: unknown }).detail
    if (typeof detail === 'string') return detail
    if (Array.isArray(detail)) {
      const first = detail[0] as { msg?: string } | undefined
      return first?.msg || '请求参数不正确'
    }
  }
  if (status === 401) return 'API Key 无效或已过期'
  if (status === 404) return '资源不存在'
  if (status === 409) return '当前状态不允许该操作'
  if (status === 415) return '不支持的文件格式'
  if (status === 422) return '请求参数不正确'
  return `请求失败（HTTP ${status}）`
}

export const bridge = {
  isNative,

  async appInfo(): Promise<AppInfo> {
    if (isNative) return callNative<AppInfo>('appInfo')
    return {
      version: 'web-preview',
      sdk: 0,
      device: navigator.userAgent,
    }
  },

  async loadConfig(): Promise<StoredConfig> {
    if (isNative) return callNative<StoredConfig>('config.load')
    try {
      const raw = localStorage.getItem(CONFIG_KEY)
      return raw ? (JSON.parse(raw) as StoredConfig) : {}
    } catch {
      return {}
    }
  },

  async saveConfig(config: StoredConfig): Promise<void> {
    if (isNative) {
      await callNative('config.save', { ...config })
      return
    }
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config))
  },

  async http<T>(
    method: string,
    url: string,
    body: unknown,
    apiKey: string,
    timeoutMs = 30000,
  ): Promise<HttpResult<T>> {
    if (isNative) {
      return callNative<HttpResult<T>>('http', {
        method,
        url,
        body: body === undefined ? '' : JSON.stringify(body),
        apiKey,
        timeoutMs,
      })
    }
    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetch(url, {
        method,
        headers: {
          'X-API-Key': apiKey,
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      })
      const parsed = await readResponse(response)
      if (!response.ok) throw new BridgeError(errorDetail(parsed, response.status), response.status)
      return { status: response.status, data: parsed as T }
    } catch (error) {
      if (error instanceof BridgeError) throw error
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new BridgeError('请求超时，请检查服务地址与网络')
      }
      throw new BridgeError('无法连接 XB-SVCB 服务，请检查地址与局域网连通性')
    } finally {
      window.clearTimeout(timer)
    }
  },

  async pickAudio(): Promise<PickedFile> {
    if (isNative) return callNative<PickedFile>('pick', { accept: 'audio/*' })
    return pickInBrowser('audio/*,video/*')
  },

  /** 读取所选音频的时长（秒），多模型分段需要。失败时返回 0。 */
  async probeAudio(token: string): Promise<number> {
    if (isNative) {
      try {
        const data = await callNative<{ duration: number }>('probeAudio', { token })
        return Number(data?.duration) || 0
      } catch {
        return 0
      }
    }
    const file = browserFiles.get(token)
    if (!file) return 0
    const url = URL.createObjectURL(file)
    return new Promise<number>((resolve) => {
      const audio = new Audio()
      let settled = false
      const finish = (value: number) => {
        if (settled) return
        settled = true
        URL.revokeObjectURL(url)
        resolve(Number.isFinite(value) && value > 0 ? value : 0)
      }
      const timer = window.setTimeout(() => finish(0), 5000)
      audio.preload = 'metadata'
      audio.onloadedmetadata = () => {
        window.clearTimeout(timer)
        finish(audio.duration)
      }
      audio.onerror = () => {
        window.clearTimeout(timer)
        finish(0)
      }
      audio.src = url
    })
  },

  async upload(
    token: string,
    url: string,
    apiKey: string,
    onProgress?: (pct: number, received: number, total: number) => void,
  ): Promise<{ upload_id: string; filename: string; size: number }> {
    if (isNative) {
      return callNative('upload', { token, url, apiKey }, onProgress)
    }
    const file = browserFiles.get(token)
    if (!file) throw new BridgeError('文件已失效，请重新选择')
    return new Promise((resolve, reject) => {
      const form = new FormData()
      form.append('file', file, file.name)
      const xhr = new XMLHttpRequest()
      xhr.open('POST', url)
      xhr.setRequestHeader('X-API-Key', apiKey)
      xhr.upload.addEventListener('progress', (event) => {
        if (!event.lengthComputable) return
        onProgress?.((event.loaded / event.total) * 100, event.loaded, event.total)
      })
      xhr.addEventListener('load', () => {
        let parsed: unknown = null
        try {
          parsed = JSON.parse(xhr.responseText)
        } catch {
          parsed = xhr.responseText
        }
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(parsed as { upload_id: string; filename: string; size: number })
          return
        }
        reject(new BridgeError(errorDetail(parsed, xhr.status), xhr.status))
      })
      xhr.addEventListener('error', () => reject(new BridgeError('上传失败，请检查网络')))
      xhr.addEventListener('abort', () => reject(new BridgeError('上传已取消')))
      xhr.send(form)
    })
  },

  async download(url: string, apiKey: string, filename: string, subdir: string): Promise<SavedDownload> {
    if (isNative) {
      return callNative<SavedDownload>('download', { url, apiKey, filename, subdir })
    }
    const response = await fetch(url, { headers: { 'X-API-Key': apiKey } })
    if (!response.ok) {
      const body = await readResponse(response)
      throw new BridgeError(errorDetail(body, response.status), response.status)
    }
    const blob = await response.blob()
    const anchor = document.createElement('a')
    anchor.href = URL.createObjectURL(blob)
    anchor.download = filename
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(anchor.href), 10000)
    return { downloadId: 0, filename }
  },

  async cacheAudio(
    url: string,
    apiKey: string,
    cacheKey: string,
    extension: string,
    onProgress?: (pct: number, received: number, total: number) => void,
  ): Promise<CachedAudio> {
    if (isNative) {
      return callNative<CachedAudio>('cacheAudio', { url, apiKey, cacheKey, extension }, onProgress)
    }
    const response = await fetch(url, { headers: { 'X-API-Key': apiKey } })
    if (!response.ok) {
      const body = await readResponse(response)
      throw new BridgeError(errorDetail(body, response.status), response.status)
    }
    const blob = await response.blob()
    onProgress?.(100, blob.size, blob.size)
    return { path: URL.createObjectURL(blob), size: blob.size }
  },

  async toast(message: string): Promise<void> {
    if (isNative) {
      await callNative('toast', { message })
      return
    }
    emitToast(message)
  },

  async vibrate(ms = 12): Promise<void> {
    if (isNative) {
      await callNative('vibrate', { ms })
      return
    }
    navigator.vibrate?.(ms)
  },

  async openUrl(url: string): Promise<void> {
    if (isNative) {
      await callNative('openUrl', { url })
      return
    }
    window.open(url, '_blank', 'noopener')
  },

  async openDownloads(): Promise<void> {
    if (isNative) {
      await callNative('openDownloads')
      return
    }
    emitToast('浏览器预览不提供系统下载目录')
  },
}
