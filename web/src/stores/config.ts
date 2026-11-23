import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { api, configureApi, normalizeServerUrl } from '@/api/client'
import { bridge, BridgeError } from '@/api/bridge'
import type { HealthInfo, ModelListResponse, SystemInfo } from '@/api/types'

export interface ProbeResult {
  ok: boolean
  message: string
  version?: string
  models?: number
  latencyMs?: number
}

/** 服务地址与 API Key 的持久化配置，以及连接状态。 */
export const useConfigStore = defineStore('mobile-config', () => {
  const serverUrl = ref('')
  const apiKey = ref('')
  const downloadSubdir = ref('XB-SVCB')
  const connected = ref(false)
  const connecting = ref(false)
  const initializing = ref(false)
  const loaded = ref(false)
  const health = ref<HealthInfo | null>(null)
  const system = ref<SystemInfo | null>(null)
  const connectionError = ref('')
  const lastSync = ref<number>(0)

  const configured = computed(() => Boolean(serverUrl.value && apiKey.value))
  const shortServer = computed(() => serverUrl.value.replace(/^https?:\/\//i, ''))
  const deviceSummary = computed(() => {
    const preferred = system.value?.inference_devices?.preferred
    if (!preferred) return ''
    return preferred === 'cpu' ? 'CPU 推理' : `${preferred.toUpperCase()} 加速`
  })

  function persist(): void {
    void bridge.saveConfig({
      serverUrl: serverUrl.value,
      apiKey: apiKey.value,
      downloadSubdir: downloadSubdir.value,
    })
  }

  async function load(): Promise<void> {
    try {
      const stored = await bridge.loadConfig()
      serverUrl.value = stored.serverUrl || ''
      apiKey.value = stored.apiKey || ''
      downloadSubdir.value = stored.downloadSubdir || 'XB-SVCB'
      configureApi(serverUrl.value, apiKey.value)
    } catch {
      // 读取配置失败时按未配置处理，至少让连接页可用。
    } finally {
      loaded.value = true
    }
    if (configured.value) {
      initializing.value = true
      try {
        await connect(true)
      } finally {
        initializing.value = false
      }
    }
  }

  async function connect(silent = false): Promise<boolean> {
    if (!configured.value) {
      connected.value = false
      return false
    }
    connecting.value = true
    connectionError.value = ''
    try {
      const info = await api.health()
      health.value = info
      connected.value = true
      if (!silent) lastSync.value = Date.now()
      void refreshSystem()
      return true
    } catch (error) {
      connected.value = false
      connectionError.value = error instanceof Error ? error.message : '无法连接服务'
      return false
    } finally {
      connecting.value = false
    }
  }

  async function refreshSystem(): Promise<void> {
    try {
      system.value = await api.system()
    } catch {
      // 环境信息读取失败不影响任务管理，设置页会显示“不可用”。
    }
  }

  async function apply(server: string, key: string, subdir?: string): Promise<boolean> {
    serverUrl.value = normalizeServerUrl(server)
    apiKey.value = key.trim()
    if (subdir) downloadSubdir.value = subdir.trim().replace(/^\/+|\/+$/g, '') || 'XB-SVCB'
    configureApi(serverUrl.value, apiKey.value)
    loaded.value = true
    persist()
    const ok = await connect()
    return ok
  }

  async function probe(server: string, key: string): Promise<ProbeResult> {
    const url = normalizeServerUrl(server)
    const trimmed = key.trim()
    if (!url) return { ok: false, message: '请填写服务地址' }
    if (!trimmed) return { ok: false, message: '请填写 API Key' }
    const started = Date.now()
    try {
      const health = await bridge.http<HealthInfo>(
        'GET',
        `${url}/health`,
        undefined,
        trimmed,
        8000,
      )
      const models = await bridge.http<ModelListResponse>(
        'GET',
        `${url}/api/v1/models`,
        undefined,
        trimmed,
        15000,
      )
      return {
        ok: true,
        message: '连接成功',
        version: health.data?.version,
        models: models.data?.total ?? 0,
        latencyMs: Date.now() - started,
      }
    } catch (error) {
      return {
        ok: false,
        message: error instanceof BridgeError ? error.message : '连接失败，请检查地址与网络',
      }
    }
  }

  function disconnect(): void {
    connected.value = false
    health.value = null
    system.value = null
    connectionError.value = ''
  }

  /** 网络中断时由任务轮询调用，回到连接页让用户修正地址 / Key。 */
  function markOffline(message = ''): void {
    connected.value = false
    connectionError.value = message || '与电脑的连接已断开'
  }

  function clear(): void {
    serverUrl.value = ''
    apiKey.value = ''
    connected.value = false
    health.value = null
    system.value = null
    configureApi('', '')
    persist()
  }

  return {
    serverUrl,
    apiKey,
    downloadSubdir,
    connected,
    connecting,
    initializing,
    loaded,
    health,
    system,
    connectionError,
    lastSync,
    configured,
    shortServer,
    deviceSummary,
    load,
    connect,
    refreshSystem,
    apply,
    probe,
    disconnect,
    markOffline,
    clear,
  }
})
