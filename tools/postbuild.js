/**
 * 把 Vite 产出的 ES Module 页面改写成 file:// 可执行的形式。
 *
 * APK 用 WebView 加载本地 assets，file 源不允许 module script，也不接受
 * 带 crossorigin 的样式表，因此这里只做最小改写，不触碰其余构建产物。
 */
const fs = require('fs')
const path = require('path')

const dist = path.resolve(__dirname, '..', 'web', 'dist')
const indexFile = path.join(dist, 'index.html')

let html = fs.readFileSync(indexFile, 'utf8')

html = html.replace(
  /<script type="module" crossorigin src="([^"]+)"><\/script>/,
  '<script defer src="$1"></script>',
)
html = html.replace(
  /<link rel="stylesheet" crossorigin href="([^"]+)">/,
  '<link rel="stylesheet" href="$1">',
)
html = html.replace(/\s+crossorigin(?=[\s>])/g, '')

fs.writeFileSync(indexFile, html)

const assets = fs.readdirSync(path.join(dist, 'assets'))
console.log(`postbuild: ${assets.join(', ')}`)
