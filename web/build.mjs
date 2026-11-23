/**
 * 无配置文件构建入口。
 *
 * Windows 中文路径下 Vite 的配置文件加载会调用外部 realpath 工具，
 * 在受限环境下会失败；这里用 JS API 直接传入配置，绕开这一层。
 */
import { fileURLToPath } from 'node:url'
import path from 'node:path'

import vue from '@vitejs/plugin-vue'
import { build } from 'vite'

const root = path.dirname(fileURLToPath(import.meta.url))

await build({
  configFile: false,
  root,
  base: './',
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.join(root, 'src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2019',
    cssTarget: 'chrome87',
    cssCodeSplit: false,
    assetsInlineLimit: 512 * 1024,
    reportCompressedSize: false,
    rollupOptions: {
      output: {
        format: 'iife',
        inlineDynamicImports: true,
        entryFileNames: 'assets/app-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
})
