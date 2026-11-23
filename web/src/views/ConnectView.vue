<script setup lang="ts">
import { computed, ref } from 'vue'

import Icon from '@/components/Icon.vue'
import { useConfigStore } from '@/stores/config'

const logoUrl = './logo.png'

const emit = defineEmits<{ (event: 'connected'): void }>()
const config = useConfigStore()

const server = ref(config.serverUrl || '')
const key = ref(config.apiKey || '')
const revealKey = ref(false)
const testing = ref(false)
const result = ref<{ ok: boolean; message: string; version?: string; models?: number; latencyMs?: number } | null>(null)

const canSubmit = computed(() => server.value.trim().length > 0 && key.value.trim().length > 0 && !testing.value)
const reconnecting = computed(() => Boolean(config.serverUrl))

async function testOnly(): Promise<void> {
  if (!canSubmit.value) return
  testing.value = true
  result.value = null
  result.value = await config.probe(server.value, key.value)
  testing.value = false
}

async function connect(): Promise<void> {
  if (!canSubmit.value) return
  testing.value = true
  result.value = null
  const probe = await config.probe(server.value, key.value)
  result.value = probe
  if (!probe.ok) {
    testing.value = false
    return
  }
  const ok = await config.apply(server.value, key.value)
  testing.value = false
  if (ok) {
    emit('connected')
  } else {
    result.value = { ok: false, message: config.connectionError || '连接失败' }
  }
}
</script>

<template>
  <div class="connect-page scroll-area">
    <div class="ambient"></div>

    <header class="connect-hero">
      <div class="logo-wrap">
        <span class="logo-halo"></span>
        <div class="logo">
          <img :src="logoUrl" alt="XB-SVCB" />
        </div>
      </div>
      <p class="kicker">// XB-SVCB MOBILE</p>
      <h1>连接你的<span class="grad-text">翻唱工作站</span></h1>
      <p class="lead">手机负责管理任务与素材，推理仍在电脑上完成。填好局域网地址与 API Key 即可开始。</p>
    </header>

    <section class="glass connect-card">
      <div v-if="config.connectionError" class="reconnect-note">
        <Icon name="alert" :size="14" />
        <div>
          <b>连接已断开</b>
          <p>{{ config.connectionError }}。请确认电脑端服务仍在运行，或修改地址与 Key 后重试。</p>
        </div>
      </div>

      <div class="field">
        <label class="field-label" for="server">
          <span>服务地址</span>
          <span class="kicker">SERVER</span>
        </label>
        <div class="input-wrap">
          <Icon name="server" :size="16" class="input-icon" />
          <input
            id="server"
            v-model="server"
            class="input with-icon"
            type="url"
            inputmode="url"
            autocapitalize="off"
            autocorrect="off"
            spellcheck="false"
            placeholder="192.168.1.10:8760"
            @keyup.enter="connect"
          />
        </div>
        <p class="hint">电脑端「资料库 → API 接入」页会显示局域网地址，默认端口 8760。</p>
      </div>

      <div class="field">
        <label class="field-label" for="key">
          <span>API Key</span>
          <button class="text-action" type="button" @click="revealKey = !revealKey">
            {{ revealKey ? '隐藏' : '显示' }}
          </button>
        </label>
        <div class="input-wrap">
          <Icon name="key" :size="16" class="input-icon" />
          <input
            id="key"
            v-model="key"
            class="input with-icon"
            :type="revealKey ? 'text' : 'password'"
            autocapitalize="off"
            autocorrect="off"
            spellcheck="false"
            placeholder="XB-SVCB-…"
            @keyup.enter="connect"
          />
        </div>
        <p class="hint">API 服务默认关闭；请先在电脑端点「启动服务」，并切换到局域网模式。</p>
      </div>

      <Transition name="result">
        <div v-if="result" class="probe" :class="result.ok ? 'ok' : 'fail'">
          <Icon :name="result.ok ? 'check' : 'alert'" :size="15" />
          <div class="probe-text">
            <b>{{ result.message }}</b>
            <span v-if="result.ok">
              v{{ result.version }} · {{ result.models }} 个声音模型 · {{ result.latencyMs }}ms
            </span>
            <span v-else>请检查电脑端服务的监听范围、端口与防火墙设置</span>
          </div>
        </div>
      </Transition>

      <div class="connect-actions">
        <button class="btn btn--block btn--primary" type="button" :disabled="!canSubmit" @click="connect">
          <span v-if="testing" class="spinner"></span>
          <Icon v-else name="link" :size="16" />
          {{ testing ? '正在连接…' : reconnecting ? '重新连接并进入' : '连接并进入' }}
        </button>
        <button class="btn btn--block btn--ghost" type="button" :disabled="!canSubmit" @click="testOnly">
          仅测试连接
        </button>
      </div>
    </section>

    <section class="tips">
      <div class="tip">
        <span class="tip-no">01</span>
        <div>
          <b>手机与电脑在同一 Wi-Fi</b>
          <p>API 监听范围选「局域网」，不要在公网直接映射端口。</p>
        </div>
      </div>
      <div class="tip">
        <span class="tip-no">02</span>
        <div>
          <b>Key 只保存在本机</b>
          <p>地址与 API Key 存于应用私有存储，不会写入日志或上传。</p>
        </div>
      </div>
      <div class="tip">
        <span class="tip-no">03</span>
        <div>
          <b>哪些事情留给电脑</b>
          <p>音频编辑、时间轴编排与自定义工作流仍在桌面端完成。</p>
        </div>
      </div>
    </section>

    <p class="footnote">XB-SVCB · 移动伴生客户端 · GPL-3.0</p>
  </div>
</template>

<style scoped>
.connect-page {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-height: 100vh;
  min-height: 100dvh;
  padding: calc(38px + env(safe-area-inset-top)) 20px calc(26px + env(safe-area-inset-bottom));
  overflow-y: auto;
}

.ambient {
  position: absolute;
  top: -120px;
  left: 50%;
  width: 420px;
  height: 420px;
  margin-left: -210px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(var(--xb-primary-rgb), 0.18), transparent 66%);
  pointer-events: none;
}

.connect-hero {
  position: relative;
  text-align: center;
}

.logo-wrap {
  position: relative;
  display: grid;
  place-items: center;
  width: 92px;
  height: 92px;
  margin: 0 auto 18px;
}

.logo-halo {
  position: absolute;
  inset: 0;
  border-radius: 30px;
  background: radial-gradient(circle, rgba(var(--xb-primary-rgb), 0.22), transparent 70%);
  filter: blur(6px);
}

.logo {
  position: relative;
  width: 84px;
  height: 84px;
  border: 1px solid rgba(var(--xb-primary-rgb), 0.4);
  border-radius: 50%;
  overflow: hidden;
  box-shadow: 0 16px 44px rgba(var(--xb-primary-rgb), 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.35);
}

.logo img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}

h1 {
  margin-top: 9px;
  font-size: 27px;
  font-weight: 900;
  letter-spacing: -0.8px;
  line-height: 1.2;
}

.lead {
  max-width: 300px;
  margin: 10px auto 0;
  color: var(--xb-muted);
  font-size: 12px;
  line-height: 1.7;
}

.connect-card {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.reconnect-note {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 11px;
  border: 1px solid rgba(var(--xb-danger-rgb), 0.32);
  border-radius: 11px;
  background: rgba(var(--xb-danger-rgb), 0.08);
  color: var(--xb-danger);
}

.reconnect-note b {
  font-size: 11px;
}

.reconnect-note p {
  margin-top: 2px;
  color: var(--xb-muted);
  font-size: 9.5px;
  line-height: 1.5;
}

.input-wrap {
  position: relative;
}

.input-icon {
  position: absolute;
  top: 50%;
  left: 12px;
  z-index: 1;
  transform: translateY(-50%);
  color: var(--xb-muted);
  pointer-events: none;
}

.input.with-icon {
  padding-left: 36px;
  font-family: ui-monospace, 'Cascadia Mono', Menlo, Consolas, monospace;
  font-size: 13px;
}

.hint {
  color: var(--xb-muted);
  font-size: 10px;
  line-height: 1.55;
  opacity: 0.85;
}

.text-action {
  color: var(--xb-primary);
  font-size: 10px;
  font-weight: 700;
}

.probe {
  display: flex;
  gap: 9px;
  padding: 10px 11px;
  border: 1px solid var(--xb-border);
  border-radius: 12px;
  background: rgba(var(--xb-fill-rgb), 0.03);
}

.probe.ok {
  border-color: rgba(var(--xb-success-rgb), 0.3);
  background: rgba(var(--xb-success-rgb), 0.07);
  color: var(--xb-success);
}

.probe.fail {
  border-color: rgba(var(--xb-danger-rgb), 0.3);
  background: rgba(var(--xb-danger-rgb), 0.07);
  color: var(--xb-danger);
}

.probe-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.probe-text b {
  font-size: 12px;
}

.probe-text span {
  color: var(--xb-muted);
  font-size: 10px;
  line-height: 1.5;
}

.connect-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tips {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 0 4px;
}

.tip {
  display: flex;
  gap: 11px;
}

.tip-no {
  flex: none;
  color: var(--xb-primary);
  font: 800 10px/1.6 ui-monospace, 'Cascadia Mono', Menlo, Consolas, monospace;
  letter-spacing: 1px;
}

.tip b {
  font-size: 12px;
}

.tip p {
  margin-top: 2px;
  color: var(--xb-muted);
  font-size: 10.5px;
  line-height: 1.55;
}

.footnote {
  margin-top: auto;
  padding-top: 6px;
  color: var(--xb-muted);
  font-size: 9px;
  letter-spacing: 1px;
  text-align: center;
  opacity: 0.6;
}

.result-enter-active,
.result-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.result-enter-from,
.result-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
