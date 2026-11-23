import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { api } from '@/api/client'
import { BridgeError } from '@/api/bridge'
import type { CreateJobPayload, Job, QueueInfo } from '@/api/types'
import { useConfigStore } from '@/stores/config'

/** 翻唱任务列表、队列与轮询。 */
export const useTasksStore = defineStore('mobile-tasks', () => {
  const jobs = ref<Job[]>([])
  const queue = ref<QueueInfo | null>(null)
  const loading = ref(false)
  const refreshing = ref(false)
  const error = ref('')
  const lastSynced = ref<number>(0)

  let timer: number | undefined
  let polling = false
  let inFlight = false

  const activeJobs = computed(() =>
    jobs.value.filter((job) => job.status === 'running' || job.status === 'queue'),
  )
  const runningJob = computed(() => jobs.value.find((job) => job.status === 'running') ?? null)
  const counts = computed(() => ({
    total: jobs.value.length,
    active: activeJobs.value.length,
    done: jobs.value.filter((job) => job.status === 'done').length,
    failed: jobs.value.filter((job) => job.status === 'failed').length,
  }))
  const hasActive = computed(() => activeJobs.value.length > 0)

  function getById(id: string | null | undefined): Job | undefined {
    if (!id) return undefined
    return jobs.value.find((job) => job.id === id)
  }

  async function load(silent = false): Promise<void> {
    if (inFlight) return
    inFlight = true
    if (!silent) loading.value = !jobs.value.length
    refreshing.value = true
    try {
      const [list, queueInfo] = await Promise.all([
        api.listJobs(120),
        api.queue().catch(() => null),
      ])
      jobs.value = list.items
      if (queueInfo) queue.value = queueInfo
      error.value = ''
      lastSynced.value = Date.now()
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : '读取任务失败'
      if (cause instanceof BridgeError && cause.status === 0) {
        useConfigStore().markOffline(cause.message)
      }
    } finally {
      inFlight = false
      loading.value = false
      refreshing.value = false
    }
  }

  async function refreshOne(id: string): Promise<void> {
    try {
      const job = await api.getJob(id)
      const index = jobs.value.findIndex((item) => item.id === id)
      if (index >= 0) jobs.value.splice(index, 1, job)
      else jobs.value.unshift(job)
    } catch {
      // 轮询失败保持旧数据，由列表顶部提示连接状态。
    }
  }

  async function create(payload: CreateJobPayload): Promise<Job> {
    const job = await api.createJob(payload)
    jobs.value.unshift(job)
    void load(true)
    return job
  }

  async function rename(id: string, title: string): Promise<void> {
    const job = await api.renameJob(id, title)
    const index = jobs.value.findIndex((item) => item.id === id)
    if (index >= 0) jobs.value.splice(index, 1, job)
  }

  async function remove(id: string): Promise<void> {
    await api.deleteJob(id)
    jobs.value = jobs.value.filter((job) => job.id !== id)
  }

  async function retry(id: string): Promise<void> {
    await api.retryJob(id)
    await refreshOne(id)
  }

  function startPolling(): void {
    stopPolling()
    polling = true
    schedule()
  }

  function schedule(): void {
    if (!polling) return
    // 有任务在执行时更密一些；空闲时降低频率，减少手机与电脑端的无谓请求。
    const delay = hasActive.value ? 3500 : 9000
    timer = window.setTimeout(async () => {
      if (!document.hidden) await load(true)
      schedule()
    }, delay)
  }

  function stopPolling(): void {
    polling = false
    if (timer !== undefined) {
      window.clearTimeout(timer)
      timer = undefined
    }
  }

  return {
    jobs,
    queue,
    loading,
    refreshing,
    error,
    lastSynced,
    activeJobs,
    runningJob,
    counts,
    hasActive,
    getById,
    load,
    refreshOne,
    create,
    rename,
    remove,
    retry,
    startPolling,
    stopPolling,
  }
})
