<script setup lang="ts">
import { computed } from 'vue'

/** 与桌面端线性图标风格一致的本地图标集，避免额外依赖与网络字体。 */
const props = withDefaults(
  defineProps<{
    name: string
    size?: number
    strokeWidth?: number
  }>(),
  { size: 20, strokeWidth: 1.8 },
)

const ICONS: Record<string, string[]> = {
  tasks: ['M4 7h16', 'M4 12h16', 'M4 17h10'],
  mic: ['M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z', 'M5 11a7 7 0 0 0 14 0', 'M12 18v3', 'M8 21h8'],
  play: ['M8 5v14l11-7z'],
  pause: ['M7 5h4v14H7z', 'M13 5h4v14h-4z'],
  plus: ['M12 5v14', 'M5 12h14'],
  download: ['M12 3v12', 'M7 10l5 5 5-5', 'M5 21h14'],
  upload: ['M12 21V9', 'M7 14l5-5 5 5', 'M5 3h14'],
  trash: ['M4 7h16', 'M9 7V4h6v3', 'M6 7l1 14h10l1-14', 'M10 11v6', 'M14 11v6'],
  edit: ['M12 20h9', 'M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z'],
  refresh: ['M20 12a8 8 0 1 1-2.3-5.6', 'M20 4v5h-5'],
  check: ['M4 12.5l5 5L20 6.5'],
  close: ['M6 6l12 12', 'M18 6L6 18'],
  chevron: ['M9 5l7 7-7 7'],
  'chevron-down': ['M6 9l6 6 6-6'],
  search: ['M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z', 'M21 21l-4.3-4.3'],
  server: ['M4 4h16v6H4z', 'M4 14h16v6H4z', 'M8 7h.01', 'M8 17h.01'],
  key: ['M14 7a4 4 0 1 1-4 4c0-.7.2-1.4.5-2L4 15.5V19h3.5l1-1v-2h2v-2h2l1.5-1.5'],
  star: ['M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z'],
  more: [],
  external: ['M14 5h5v5', 'M19 5l-8 8', 'M19 14v5H5V5h5'],
  folder: ['M3 7h6l2 2h10v10H3z'],
  music: ['M9 18V5l11-2v13', 'M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', 'M17 19a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'],
  alert: ['M12 3l9 17H3z', 'M12 9v5', 'M12 17h.01'],
  info: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M12 11v5', 'M12 8h.01'],
  clock: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M12 7v5l3 2'],
  waveform: ['M4 10v4', 'M8 7v10', 'M12 4v16', 'M16 8v8', 'M20 10v4'],
  sparkles: ['M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z', 'M19 16l.9 2.1L22 19l-2.1.9L19 22l-.9-2.1L16 19l2.1-.9z'],
  power: ['M12 3v9', 'M6.6 6.6a8 8 0 1 0 10.8 0'],
  'arrow-left': ['M19 12H5', 'M11 6l-6 6 6 6'],
  'arrow-up-right': ['M7 17L17 7', 'M8 7h9v9'],
  wifi: ['M5 12.5a10 10 0 0 1 14 0', 'M8.5 16a5.5 5.5 0 0 1 7 0', 'M12 19.5h.01'],
  copy: ['M9 9h10v10H9z', 'M5 15V5h10'],
  chip: ['M7 7h10v10H7z', 'M10 3v4', 'M14 3v4', 'M10 17v4', 'M14 17v4', 'M3 10h4', 'M3 14h4', 'M17 10h4', 'M17 14h4'],
  headphones: ['M4 14v-2a8 8 0 0 1 16 0v2', 'M4 14h3v6H5a1 1 0 0 1-1-1z', 'M20 14h-3v6h2a1 1 0 0 0 1-1z'],
  disc: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'],
  file: ['M6 3h8l4 4v14H6z', 'M14 3v4h4'],
  volume: ['M4 9h4l5-4v14l-5-4H4z', 'M17 9a4 4 0 0 1 0 6'],
  sliders: ['M4 7h10', 'M18 7h2', 'M4 17h4', 'M12 17h8', 'M15 4v6', 'M8 14v6'],
  shield: ['M12 3l8 3v6c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V6z'],
  link: ['M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1', 'M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1'],
  cloud: ['M7 18a4 4 0 0 1 .6-7.96A6 6 0 0 1 19 9.5a3.5 3.5 0 0 1-1 6.5z'],
  store: ['M4 9l1.5-5h13L20 9', 'M4 9h16v11H4z', 'M9 20v-6h6v6'],
}

const FILLED = new Set(['play', 'pause'])
const paths = computed(() => ICONS[props.name] ?? ICONS.info)
const filled = computed(() => FILLED.has(props.name))
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    :fill="filled ? 'currentColor' : 'none'"
    :stroke="filled ? 'none' : 'currentColor'"
    :stroke-width="strokeWidth"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    class="xb-icon"
  >
    <template v-if="name === 'more'">
      <circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none" />
    </template>
    <path v-for="(d, index) in paths" :key="index" :d="d" />
  </svg>
</template>

<style scoped>
.xb-icon {
  display: block;
  flex: none;
}
</style>
