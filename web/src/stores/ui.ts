import { defineStore } from 'pinia'
import { ref } from 'vue'

import { bridge } from '@/api/bridge'

export type ToastKind = 'info' | 'success' | 'error' | 'warn'

export interface ToastItem {
  id: number
  message: string
  kind: ToastKind
}

export interface ConfirmOptions {
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
}

export interface PromptOptions {
  title: string
  message?: string
  value?: string
  placeholder?: string
  confirmText?: string
  maxLength?: number
}

interface PendingConfirm {
  options: ConfirmOptions
  resolve: (value: boolean) => void
}

interface PendingPrompt {
  options: PromptOptions
  resolve: (value: string | null) => void
}

/** 全局浮层、提示与确认框；组件只负责渲染，状态集中在这里。 */
export const useUiStore = defineStore('mobile-ui', () => {
  const toasts = ref<ToastItem[]>([])
  const confirmState = ref<PendingConfirm | null>(null)
  const promptState = ref<PendingPrompt | null>(null)
  const activeTaskId = ref<string | null>(null)
  const taskAutoplay = ref(false)
  let toastSeq = 0

  function toast(message: string, kind: ToastKind = 'info', duration = 2600): void {
    if (!message) return
    const id = ++toastSeq
    toasts.value.push({ id, message, kind })
    window.setTimeout(() => {
      toasts.value = toasts.value.filter((item) => item.id !== id)
    }, duration)
    if (kind === 'error') void bridge.vibrate(24)
  }

  function dismissToast(id: number): void {
    toasts.value = toasts.value.filter((item) => item.id !== id)
  }

  function confirm(options: ConfirmOptions): Promise<boolean> {
    confirmState.value?.resolve(false)
    return new Promise<boolean>((resolve) => {
      confirmState.value = {
        options,
        resolve: (value) => {
          confirmState.value = null
          resolve(value)
        },
      }
    })
  }

  function answerConfirm(value: boolean): void {
    confirmState.value?.resolve(value)
  }

  function prompt(options: PromptOptions): Promise<string | null> {
    promptState.value?.resolve(null)
    return new Promise<string | null>((resolve) => {
      promptState.value = {
        options,
        resolve: (value) => {
          promptState.value = null
          resolve(value)
        },
      }
    })
  }

  function answerPrompt(value: string | null): void {
    promptState.value?.resolve(value)
  }

  function openTask(id: string, autoplay = false): void {
    activeTaskId.value = id
    taskAutoplay.value = autoplay
  }

  function closeTask(): void {
    activeTaskId.value = null
    taskAutoplay.value = false
  }

  function haptic(ms = 12): void {
    void bridge.vibrate(ms)
  }

  window.addEventListener('xb-toast', (event) => {
    const message = (event as CustomEvent<string>).detail
    toast(message)
  })

  return {
    toasts,
    confirmState,
    promptState,
    activeTaskId,
    taskAutoplay,
    toast,
    dismissToast,
    confirm,
    answerConfirm,
    prompt,
    answerPrompt,
    openTask,
    closeTask,
    haptic,
  }
})
