<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import Icon from '@/components/Icon.vue'
import { apiBaseUrl } from '@/api/client'
import { bridge } from '@/api/bridge'
import type { AppInfo } from '@/api/bridge'
import { locale, localeOptions, setLocale, t } from '@/i18n'
import { useConfigStore } from '@/stores/config'
import { usePrefsStore } from '@/stores/prefs'
import { useUiStore } from '@/stores/ui'
import type { MobileTheme } from '@/stores/prefs'

const config = useConfigStore()
const prefs = usePrefsStore()
const ui = useUiStore()

const appInfo = ref<AppInfo | null>(null)
const editing = ref(false)
const serverDraft = ref(config.serverUrl)
const keyDraft = ref(config.apiKey)
const subdirDraft = ref(config.downloadSubdir)
const saving = ref(false)
const testing = ref(false)

const maskKey = computed(() => {
  const key = config.apiKey
  if (!key) return '未配置'
  if (key.length <= 12) return `${key.slice(0, 4)}••••`
  return `${key.slice(0, 10)}••••${key.slice(-4)}`
})

const THEMES: { key: MobileTheme; labelKey: string; hintKey: string }[] = [
  { key: 'cyber', labelKey: 'settings.themeCyber', hintKey: 'settings.themeCyberHint' },
  { key: 'brand', labelKey: 'settings.themeBrand', hintKey: 'settings.themeBrandHint' },
  { key: 'anime', labelKey: 'settings.themeAnime', hintKey: 'settings.themeAnimeHint' },
]

const tools = computed(() => config.system?.tools ?? [])
const TOOL_NAMES: Record<string, string> = {
  uvr: 'UVR vocal separation',
  ffmpeg: 'FFmpeg',
  pymss: 'PyMSS vocal separation',
  svc: 'So-VITS-SVC engine',
  rvc: 'RVC engine',
  seedvc: 'SeedVC engine',
  ddsp: 'DDSP-SVC engine',
}

function toolName(tool: { key: string; name: string }): string {
  if (locale.value === 'zh-CN') return tool.name
  return TOOL_NAMES[tool.key] || tool.name
}

function toolStatus(value: string): string {
  if (locale.value === 'zh-CN') return value
  return value
    .replace('CUDA 可用', 'CUDA available')
    .replace('环境就绪', 'Environment ready')
    .replace('已就绪', 'Ready')
    .replace('显存不足时自动降级', 'Falls back when VRAM is low')
    .replace('就绪', 'Ready')
}

function deviceOptionLabel(option: { value: string; label: string; name?: string | null }): string {
  if (locale.value === 'zh-CN') return option.label
  if (option.value === 'auto') return 'Auto'
  return option.name || option.label || option.value.toUpperCase()
}

const deviceLabel = computed(() => {
  const devices = config.system?.inference_devices
  if (!devices) return ''
  const preferred = devices.preferred
  const option = devices.options?.find((item) => item.value === preferred)
  if (!option) return preferred.toUpperCase()
  return deviceOptionLabel(option)
})

function startEdit(): void {
  serverDraft.value = config.serverUrl
  keyDraft.value = config.apiKey
  editing.value = true
}

async function saveConnection(): Promise<void> {
  if (!serverDraft.value.trim() || !keyDraft.value.trim()) {
    ui.toast('服务地址与 API Key 都不能为空', 'warn')
    return
  }
  saving.value = true
  try {
    const ok = await config.apply(serverDraft.value, keyDraft.value, subdirDraft.value)
    if (ok) {
      editing.value = false
      ui.toast('连接配置已更新', 'success')
    } else {
      ui.toast(config.connectionError || '连接失败，请检查地址与 Key', 'error')
    }
  } finally {
    saving.value = false
  }
}

async function testConnection(): Promise<void> {
  testing.value = true
  try {
    const result = await config.probe(config.serverUrl, config.apiKey)
    ui.toast(
      result.ok
        ? `连接正常 · v${result.version} · ${result.models} 个模型 · ${result.latencyMs}ms`
        : result.message,
      result.ok ? 'success' : 'error',
      result.ok ? 2600 : 4200,
    )
    if (result.ok) void config.refreshSystem()
  } finally {
    testing.value = false
  }
}

async function saveSubdir(): Promise<void> {
  const value = subdirDraft.value.trim().replace(/^\/+|\/+$/g, '') || 'XB-SVCB'
  config.downloadSubdir = value
  subdirDraft.value = value
  await bridge.saveConfig({
    serverUrl: config.serverUrl,
    apiKey: config.apiKey,
    downloadSubdir: value,
  })
  ui.toast('下载目录已更新', 'success')
}

async function openDocs(): Promise<void> {
  if (!apiBaseUrl()) return
  await bridge.openUrl(`${apiBaseUrl()}/docs`)
}

async function disconnect(): Promise<void> {
  const ok = await ui.confirm({
    title: '清除连接配置？',
    message: '会移除本机保存的服务地址与 API Key，需要重新填写才能连接。不会影响电脑端任务。',
    confirmText: '清除',
    danger: true,
  })
  if (!ok) return
  config.clear()
  editing.value = false
  ui.toast('连接配置已清除', 'success')
  window.location.hash = '#/tasks'
}

onMounted(async () => {
  appInfo.value = await bridge.appInfo()
  if (!config.system) void config.refreshSystem()
})
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <p class="kicker">{{ t('settings.kicker') }}</p>
        <h1 class="page-title">{{ t('settings.title') }}</h1>
        <p class="page-sub">{{ t('settings.sub') }}</p>
      </div>
      <button class="icon-btn" type="button" :aria-label="t('settings.test')" @click="testConnection">
        <span v-if="testing" class="spinner" style="width: 15px; height: 15px"></span>
        <Icon v-else name="wifi" :size="18" />
      </button>
    </div>

    <section class="glass group">
      <div class="group-head">
        <span class="group-icon"><Icon name="server" :size="16" /></span>
        <div class="grow">
          <h2>{{ t('settings.connection') }}</h2>
          <p>{{ t('settings.connectionSub') }}</p>
        </div>
        <span class="conn-pill" :class="config.connected ? 'on' : 'off'">
          {{ config.connected ? t('settings.connected') : t('settings.disconnected') }}
        </span>
      </div>

      <template v-if="!editing">
        <div class="kv">
          <span>{{ t('settings.address') }}</span>
          <b class="mono">{{ config.serverUrl || '—' }}</b>
        </div>
        <div class="kv">
          <span>{{ t('settings.key') }}</span>
          <b class="mono">{{ maskKey }}</b>
        </div>
        <div class="kv">
          <span>{{ t('settings.version') }}</span>
          <b>{{ config.health ? `v${config.health.version} · API ${config.health.api_version}` : '—' }}</b>
        </div>
        <div class="kv">
          <span>{{ t('settings.device') }}</span>
          <b>{{ deviceLabel || config.deviceSummary || '—' }}</b>
        </div>
        <div class="conn-actions">
          <button class="btn btn--sm" type="button" @click="testConnection" :disabled="testing">
            {{ testing ? t('settings.testing') : t('settings.test') }}
          </button>
          <button class="btn btn--sm" type="button" @click="startEdit">{{ t('settings.edit') }}</button>
          <button class="btn btn--sm btn--danger" type="button" @click="disconnect">{{ t('settings.clear') }}</button>
        </div>
      </template>

      <template v-else>
        <div class="field">
          <label class="field-label" for="edit-server">{{ t('settings.address') }}</label>
          <input
            id="edit-server"
            v-model="serverDraft"
            class="input mono"
            inputmode="url"
            autocapitalize="off"
            placeholder="http://192.168.1.10:8760"
          />
        </div>
        <div class="field">
          <label class="field-label" for="edit-key">{{ t('settings.key') }}</label>
          <input
            id="edit-key"
            v-model="keyDraft"
            class="input mono"
            autocapitalize="off"
            placeholder="XB-SVCB-…"
          />
        </div>
        <div class="conn-actions">
          <button class="btn btn--sm btn--primary" type="button" :disabled="saving" @click="saveConnection">
            <span v-if="saving" class="spinner dark" style="width: 13px; height: 13px"></span>
            {{ saving ? t('settings.saving') : t('settings.saveReconnect') }}
          </button>
          <button class="btn btn--sm btn--ghost" type="button" :disabled="saving" @click="editing = false">
            {{ t('settings.cancel') }}
          </button>
        </div>
      </template>
    </section>

    <section v-if="tools.length" class="glass group">
      <div class="group-head">
        <span class="group-icon"><Icon name="chip" :size="16" /></span>
        <div class="grow">
          <h2>{{ t('settings.env') }}</h2>
          <p>{{ t('settings.envSub') }}</p>
        </div>
      </div>
      <div class="tool-list">
        <div v-for="tool in tools.slice(0, 6)" :key="tool.key" class="tool-row">
          <span class="tool-dot" :class="{ ok: tool.ok }"></span>
          <div class="grow">
            <b>{{ toolName(tool) }}</b>
            <p>{{ tool.version }} · {{ toolStatus(tool.status) }}</p>
          </div>
          <span class="tool-state" :class="{ ok: tool.ok }">{{ tool.ok ? t('settings.available') : t('settings.abnormal') }}</span>
        </div>
      </div>

      <div v-if="config.system?.inference_devices?.options?.length" class="device-block">
        <span class="field-label">{{ t('settings.devices') }}</span>
        <div class="device-chips">
          <span
            v-for="option in config.system.inference_devices.options"
            :key="option.value"
            class="device-chip"
            :class="{ on: option.value === config.system.inference_devices.preferred }"
          >
            <b>{{ deviceOptionLabel(option) }}</b>
            <small>{{ option.name || option.backend }}</small>
          </span>
        </div>
        <p class="device-note">
          {{ t('settings.devicesNote') }}
        </p>
      </div>
    </section>

    <section class="glass group">
      <div class="group-head">
        <span class="group-icon"><Icon name="download" :size="16" /></span>
        <div class="grow">
          <h2>{{ t('settings.downloads') }}</h2>
          <p>{{ t('settings.downloadsSub') }}</p>
        </div>
      </div>
      <div class="subdir-row">
        <span class="path-prefix mono">{{ t('settings.downloads') }} /</span>
        <input v-model="subdirDraft" class="input mono subdir-input" type="text" maxlength="40" />
        <button class="btn btn--sm" type="button" @click="saveSubdir">{{ t('settings.save') }}</button>
      </div>
      <button class="wide-link" type="button" @click="bridge.openDownloads()">
        <Icon name="folder" :size="15" />
        {{ t('settings.openDownloads') }}
        <Icon name="arrow-up-right" :size="13" />
      </button>
    </section>

    <section class="glass group">
      <div class="group-head">
        <span class="group-icon"><Icon name="info" :size="16" /></span>
        <div class="grow">
          <h2>{{ t('settings.language') }}</h2>
          <p>{{ t('settings.languageSub') }}</p>
        </div>
      </div>
      <div class="lang-options">
        <button
          v-for="option in localeOptions"
          :key="option.value"
          class="lang-btn"
          :class="{ on: locale === option.value }"
          type="button"
          @click="setLocale(option.value)"
        >
          <b>{{ option.short }}</b>
          <span>{{ option.label }}</span>
        </button>
      </div>
    </section>

    <section class="glass group">
      <div class="group-head">
        <span class="group-icon"><Icon name="sparkles" :size="16" /></span>
        <div class="grow">
          <h2>{{ t('settings.appearance') }}</h2>
          <p>{{ t('settings.appearanceSub') }}</p>
        </div>
      </div>
      <div class="themes">
        <button
          v-for="item in THEMES"
          :key="item.key"
          class="theme"
          :class="[`theme--${item.key}`, { on: prefs.theme === item.key }]"
          type="button"
          @click="prefs.setTheme(item.key)"
        >
          <span class="swatch"></span>
          <b>{{ t(item.labelKey) }}</b>
          <span>{{ t(item.hintKey) }}</span>
          <Icon v-if="prefs.theme === item.key" name="check" :size="12" :stroke-width="3" class="theme-check" />
        </button>
      </div>
    </section>

    <section class="glass group">
      <div class="group-head">
        <span class="group-icon"><Icon name="info" :size="16" /></span>
        <div class="grow">
          <h2>{{ t('settings.about') }}</h2>
          <p>{{ t('settings.aboutSub') }}</p>
        </div>
      </div>
      <div class="kv">
        <span>{{ t('settings.clientVersion') }}</span>
        <b class="mono">{{ appInfo?.version || '—' }}</b>
      </div>
      <div class="kv">
        <span>Android</span>
        <b>{{ appInfo?.sdk ? `API ${appInfo.sdk}` : t('settings.browserPreview') }}</b>
      </div>
      <div class="kv">
        <span>{{ t('settings.desktopVersion') }}</span>
        <b>{{ config.health ? `v${config.health.version}` : '—' }}</b>
      </div>
      <div class="kv">
        <span>{{ t('settings.license') }}</span>
        <b>GPL-3.0-only</b>
      </div>
      <button class="wide-link" type="button" @click="openDocs">
        <Icon name="link" :size="15" />
        {{ t('settings.openDocs') }}
        <Icon name="arrow-up-right" :size="13" />
      </button>
    </section>

    <p class="settings-note">
      {{ t('settings.note') }}
    </p>
  </div>
</template>

<style scoped>
.group {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 13px;
  border-radius: 17px;
}

.group-head {
  display: flex;
  align-items: center;
  gap: 9px;
}

.group-icon {
  display: grid;
  place-items: center;
  flex: none;
  width: 34px;
  height: 34px;
  border-radius: 11px;
  background: rgba(var(--xb-primary-rgb), 0.1);
  color: var(--xb-primary);
}

.group-head h2 {
  font-size: 12.5px;
  font-weight: 800;
}

.group-head p {
  margin-top: 1px;
  color: var(--xb-muted);
  font-size: 9px;
}

.conn-pill {
  flex: none;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 9px;
  font-weight: 800;
}

.conn-pill.on {
  background: rgba(var(--xb-success-rgb), 0.1);
  color: var(--xb-success);
}

.conn-pill.off {
  background: rgba(var(--xb-danger-rgb), 0.1);
  color: var(--xb-danger);
}

.kv {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding: 4px 0;
  border-bottom: 1px dashed var(--xb-border);
}

.kv:last-of-type {
  border-bottom: 0;
}

.kv span {
  flex: none;
  color: var(--xb-muted);
  font-size: 10px;
}

.kv b {
  min-width: 0;
  font-size: 10.5px;
  font-weight: 700;
  text-align: right;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.conn-actions {
  display: flex;
  gap: 6px;
  margin-top: 2px;
}

.conn-actions .btn {
  flex: 1 1 0;
}

.subdir-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.path-prefix {
  flex: none;
  color: var(--xb-muted);
  font-size: 10px;
}

.subdir-input {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 38px;
  padding: 7px 9px;
  font-size: 11px;
}

.wide-link {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 38px;
  padding: 0 10px;
  border: 1px solid var(--xb-border);
  border-radius: 10px;
  color: var(--xb-muted);
  font-size: 10.5px;
  font-weight: 700;
}

.wide-link :last-child {
  margin-left: auto;
}

.wide-link:active {
  border-color: var(--xb-border-strong);
  color: var(--xb-primary);
}

.tool-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.device-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 9px;
  border-top: 1px dashed var(--xb-border);
}

.device-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.device-chip {
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 5px 8px;
  border: 1px solid var(--xb-border);
  border-radius: 8px;
  background: rgba(var(--xb-fill-rgb), 0.025);
}

.device-chip b {
  font-size: 9.5px;
}

.device-chip small {
  color: var(--xb-muted);
  font-size: 8px;
}

.device-chip.on {
  border-color: rgba(var(--xb-success-rgb), 0.35);
  background: rgba(var(--xb-success-rgb), 0.06);
}

.device-chip.on b {
  color: var(--xb-success);
}

.device-note {
  color: var(--xb-muted);
  font-size: 8.5px;
  line-height: 1.5;
}

.tool-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tool-dot {
  flex: none;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--xb-danger);
}

.tool-dot.ok {
  background: var(--xb-success);
  box-shadow: 0 0 6px rgba(var(--xb-success-rgb), 0.7);
}

.tool-row b {
  font-size: 10.5px;
}

.tool-row p {
  color: var(--xb-muted);
  font-size: 8.5px;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tool-state {
  flex: none;
  padding: 1px 6px;
  border-radius: 999px;
  background: rgba(var(--xb-danger-rgb), 0.08);
  color: var(--xb-danger);
  font-size: 8px;
  font-weight: 800;
}

.tool-state.ok {
  background: rgba(var(--xb-success-rgb), 0.08);
  color: var(--xb-success);
}

.lang-options {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}

.lang-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 38px;
  padding: 0 9px;
  border: 1px solid var(--xb-border);
  border-radius: 10px;
  background: rgba(var(--xb-fill-rgb), 0.025);
  color: var(--xb-muted);
  font-size: 10px;
  font-weight: 700;
}

.lang-btn b {
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  border-radius: 6px;
  background: rgba(var(--xb-fill-rgb), 0.06);
  font-size: 9px;
}

.lang-btn.on {
  border-color: rgba(var(--xb-primary-rgb), 0.55);
  background: rgba(var(--xb-primary-rgb), 0.08);
  color: var(--xb-primary);
}

.lang-btn.on b {
  background: rgba(var(--xb-primary-rgb), 0.16);
}

.themes {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}

.theme {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1px;
  padding: 9px;
  border: 1px solid var(--xb-border);
  border-radius: 11px;
  background: rgba(var(--xb-fill-rgb), 0.025);
  text-align: left;
}

.theme.on {
  border-color: var(--xb-primary);
  box-shadow: 0 0 0 1px rgba(var(--xb-primary-rgb), 0.3);
}

.swatch {
  width: 100%;
  height: 20px;
  margin-bottom: 4px;
  border-radius: 6px;
}

.theme--cyber .swatch {
  background: linear-gradient(120deg, #00f0ff, #2f6bff 55%, #ff2e88);
}

.theme--brand .swatch {
  background: linear-gradient(120deg, #ff4faf, #9b5cff 55%, #7edcff);
}

.theme--anime .swatch {
  background: linear-gradient(120deg, #5b9cff, #a07bff 55%, #ff84bd);
}

.theme b {
  font-size: 10.5px;
}

.theme > span:last-of-type {
  color: var(--xb-muted);
  font-size: 8px;
}

.theme-check {
  position: absolute;
  top: 6px;
  right: 6px;
  color: var(--xb-primary);
}

.settings-note {
  padding: 2px 4px 0;
  color: var(--xb-muted);
  font-size: 9px;
  line-height: 1.6;
  text-align: center;
  opacity: 0.78;
}

.spinner.dark {
  border-color: rgba(0, 0, 0, 0.2);
  border-top-color: var(--xb-on-primary);
}
</style>
