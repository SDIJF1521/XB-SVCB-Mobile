/**
 * 下载 Android SDK 构建所需的平台与构建工具包。
 * 只依赖 Node 自带 https 模块，失败时保留 .part 文件以便续传。
 */
const fs = require('fs')
const path = require('path')
const https = require('https')

const SDK_DIR = path.resolve(__dirname, 'android-sdk')
const CACHE_DIR = path.resolve(__dirname, '.cache')

/** @type {{url: string, file: string}[]} */
const PACKAGES = [
  { url: 'https://dl.google.com/android/repository/platform-35_r02.zip', file: 'platform-35_r02.zip' },
  { url: 'https://dl.google.com/android/repository/build-tools_r35_windows.zip', file: 'build-tools_r35_windows.zip' },
]

function download(url, target) {
  return new Promise((resolve, reject) => {
    const part = target + '.part'
    const start = fs.existsSync(part) ? fs.statSync(part).size : 0
    const headers = start > 0 ? { Range: `bytes=${start}-` } : {}
    const request = https.get(url, { headers, timeout: 60000 }, (response) => {
      if (response.statusCode === 416) {
        fs.renameSync(part, target)
        resolve()
        return
      }
      if (response.statusCode !== 200 && response.statusCode !== 206) {
        reject(new Error(`HTTP ${response.statusCode} ${url}`))
        return
      }
      const total = Number(response.headers['content-length'] || 0) + start
      const out = fs.createWriteStream(part, { flags: start > 0 ? 'a' : 'w' })
      let received = start
      let lastReport = 0
      response.on('data', (chunk) => {
        received += chunk.length
        if (Date.now() - lastReport > 2000) {
          lastReport = Date.now()
          const pct = total ? ((received / total) * 100).toFixed(1) : '?'
          console.log(`${path.basename(target)} ${pct}% (${(received / 1048576).toFixed(1)} MB)`)
        }
      })
      response.pipe(out)
      out.on('finish', () => out.close(() => {
        fs.renameSync(part, target)
        resolve()
      }))
      out.on('error', reject)
    })
    request.on('timeout', () => request.destroy(new Error('timeout')))
    request.on('error', reject)
  })
}

;(async () => {
  fs.mkdirSync(CACHE_DIR, { recursive: true })
  fs.mkdirSync(SDK_DIR, { recursive: true })
  for (const pkg of PACKAGES) {
    const target = path.join(CACHE_DIR, pkg.file)
    if (fs.existsSync(target) && fs.statSync(target).size > 1000000) {
      console.log(`skip ${pkg.file}`)
      continue
    }
    console.log(`download ${pkg.url}`)
    await download(pkg.url, target)
  }
  console.log('done')
})().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
