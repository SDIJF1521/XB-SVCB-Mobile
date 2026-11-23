/**
 * 用 Edge + Puppeteer 以真实手机视口渲染移动端页面并截图。
 * 仅用于开发验证：需要先启动 mock-server.js，并完成 web 构建。
 *
 * 用法：node tools/shoot.js [scenario...]
 */
const fs = require('fs')
const path = require('path')
const puppeteer = require('puppeteer-core')

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const OUT = path.resolve(__dirname, '..', '.screenshots')
const BASE = 'http://127.0.0.1:8788'
const CONNECT = `${BASE}/?server=${encodeURIComponent(BASE)}&key=demo-key`

const VIEWPORT = { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }

/** 生成创建流程测试用的小 WAV，避免依赖仓库外的音频文件。 */
function ensureSample() {
  const file = path.join(__dirname, '..', '.screenshots', 'sample.wav')
  if (fs.existsSync(file)) return file
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const rate = 22050
  const seconds = 4
  const samples = rate * seconds
  const buffer = Buffer.alloc(44 + samples * 2)
  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + samples * 2, 4)
  buffer.write('WAVE', 8)
  buffer.write('fmt ', 12)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(1, 22)
  buffer.writeUInt32LE(rate, 24)
  buffer.writeUInt32LE(rate * 2, 28)
  buffer.writeUInt16LE(2, 32)
  buffer.writeUInt16LE(16, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(samples * 2, 40)
  for (let i = 0; i < samples; i += 1) {
    const value = Math.sin((2 * Math.PI * 440 * i) / rate) * 0.2
    buffer.writeInt16LE(Math.round(value * 32767), 44 + i * 2)
  }
  fs.writeFileSync(file, buffer)
  return file
}

async function open(browser, context, hash, waitSelector) {
  const page = await context.newPage()
  page.on('pageerror', (error) => console.log(`pageerror: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error') console.log(`console: ${message.text()}`)
  })
  await page.setViewport(VIEWPORT)
  await page.goto(`${CONNECT}#/${hash}`, { waitUntil: 'domcontentloaded', timeout: 45000 })
  if (waitSelector) await page.waitForSelector(waitSelector, { timeout: 20000 })
  await page.addStyleTag({
    content: '*,*::before,*::after{animation-duration:.001s!important;animation-delay:0s!important;transition:none!important}',
  })
  await new Promise((resolve) => setTimeout(resolve, 1400))
  return page
}

async function snap(page, name) {
  fs.mkdirSync(OUT, { recursive: true })
  await page.screenshot({ path: path.join(OUT, `${name}.png`) })
  console.log(`shot ${name}.png`)
}

const scenarios = {
  async connect(browser) {
    const context = await browser.createBrowserContext()
    const page = await context.newPage()
    await page.setViewport(VIEWPORT)
    await page.goto(BASE, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('.connect-card', { timeout: 20000 })
    await new Promise((resolve) => setTimeout(resolve, 900))
    await snap(page, '01-connect')
    await context.close()
  },

  async tasks(browser, context) {
    const page = await open(browser, context, 'tasks', '.task-card')
    await snap(page, '02-tasks')
    await page.close()
  },

  async create(browser, context) {
    const page = await open(browser, context, 'create', '.create-card')
    await snap(page, '03-create')
    await page.close()
  },

  async models(browser, context) {
    const page = await open(browser, context, 'models', '.voice-card')
    await snap(page, '04-models')
    await page.close()
  },

  async multimode(browser, context) {
    const page = await open(browser, context, 'create', '.create-card')
    await page.evaluate(() => {
      const button = [...document.querySelectorAll('.mode-seg button')].find((item) =>
        item.textContent.includes('多模型'),
      )
      button?.click()
    })
    await page.waitForSelector('.segment-editor', { timeout: 10000 })
    await new Promise((resolve) => setTimeout(resolve, 600))
    await snap(page, '15-create-multi')
    await page.evaluate(() => {
      document.querySelector('.segment-editor')?.scrollIntoView({ block: 'center' })
    })
    await new Promise((resolve) => setTimeout(resolve, 400))
    await snap(page, '16-create-segments')
    await page.close()
  },

  async multiflow(browser, context) {
    const page = await open(browser, context, 'create', '.create-card')
    const [chooser] = await Promise.all([page.waitForFileChooser(), page.click('.dropzone')])
    await chooser.accept([ensureSample()])
    await page.waitForSelector('.upload-ok', { timeout: 30000 })
    await page.evaluate(() => {
      const button = [...document.querySelectorAll('.mode-seg button')].find((item) =>
        item.textContent.includes('多模型'),
      )
      button?.click()
    })
    await page.waitForSelector('.segment-editor', { timeout: 10000 })
    await new Promise((resolve) => setTimeout(resolve, 800))
    console.log(
      'segments',
      await page.evaluate(() =>
        [...document.querySelectorAll('.seg-card')].map((card) => {
          const inputs = [...card.querySelectorAll('.time-input')].map((input) => input.value)
          return inputs.join(' - ')
        }),
      ),
    )
    await page.evaluate(() => {
      document.querySelector('.submit')?.click()
    })
    await page.waitForFunction(() => location.hash === '#/tasks', { timeout: 20000 })
    await new Promise((resolve) => setTimeout(resolve, 1200))
    console.log(
      'multi job',
      await page.evaluate(() => document.querySelector('.task-card .title')?.textContent),
    )
    await page.close()
  },

  async params(browser, context) {
    const page = await open(browser, context, 'create', '.create-card')
    await page.evaluate(() => {
      const toggles = [...document.querySelectorAll('.advanced-toggle')]
      toggles[0]?.click()
    })
    await page.waitForSelector('.model-params', { timeout: 10000 })
    console.log(
      'model params',
      await page.evaluate(() =>
        [...document.querySelectorAll('.model-params .range-label')].map((el) => el.textContent),
      ),
    )
    await page.evaluate(() => {
      const block = [...document.querySelectorAll('.setting-block')].find((item) =>
        item.textContent.includes('AI'),
      )
      block?.querySelector('.switch')?.click()
    })
    await page.waitForSelector('.ai-params', { timeout: 10000 })
    await page.evaluate(() => {
      document.querySelector('.ai-params')?.scrollIntoView({ block: 'center' })
    })
    await new Promise((resolve) => setTimeout(resolve, 600))
    await snap(page, '17-params')
    const values = await page.evaluate(() =>
      [...document.querySelectorAll('.ai-params .range-value')].map((el) => el.textContent),
    )
    console.log('ai values', values.join(','))
    await page.close()
  },

  async pymsspicker(browser, context) {
    const page = await open(browser, context, 'create', '.create-card')
    await page.evaluate(() => {
      const buttons = [...document.querySelectorAll('.engine-seg button')]
      buttons[1]?.click()
    })
    await page.waitForSelector('.pymss-picker', { timeout: 10000 })
    await page.evaluate(() => {
      document.querySelector('.pymss-picker')?.scrollIntoView({ block: 'center' })
    })
    await new Promise((resolve) => setTimeout(resolve, 600))
    console.log(
      'pymss options',
      await page.evaluate(() =>
        [...document.querySelectorAll('.pymss-row .row-title b')].map((el) => el.textContent),
      ),
    )
    await snap(page, '28-pymss-picker')
    await page.close()
  },

  async modelparams(browser, context) {
    const page = await open(browser, context, 'create', '.create-card')
    await page.evaluate(() => {
      document.querySelectorAll('.advanced-toggle')[0]?.click()
    })
    await page.waitForSelector('.model-params', { timeout: 10000 })
    await page.evaluate(() => {
      document.querySelector('.model-params')?.scrollIntoView({ block: 'center' })
    })
    await new Promise((resolve) => setTimeout(resolve, 600))
    await snap(page, '27-model-params')
    console.log(
      'model params text',
      await page.evaluate(() =>
        document.querySelector('.model-params')?.textContent?.replace(/\s+/g, ' '),
      ),
    )
    await page.close()
  },

  async english(browser, context) {
    const page = await open(browser, context, 'tasks', '.task-card')
    await page.evaluate(() => {
      localStorage.setItem('xb-svcb.mobile.locale', 'en-US')
      location.reload()
    })
    await page.waitForSelector('.task-card', { timeout: 20000 })
    await new Promise((resolve) => setTimeout(resolve, 900))
    await snap(page, '19-english')
    await page.close()
  },

  async libraryflow(browser, context) {
    const page = await open(browser, context, 'create', '.create-card')
    await page.click('.library-pick')
    await page.waitForSelector('.library-row', { timeout: 20000 })
    await snap(page, '20-library')
    await page.evaluate(() => {
      document.querySelector('.library-row')?.click()
    })
    await page.waitForSelector('.upload-ok', { timeout: 20000 })
    await new Promise((resolve) => setTimeout(resolve, 900))
    console.log(
      'library song',
      await page.evaluate(() => document.querySelector('.song-info b')?.textContent),
    )
    await snap(page, '21-library-selected')
    await page.close()
  },

  async lyricsflow(browser, context) {
    const page = await open(browser, context, 'create', '.create-card')
    await page.evaluate(() => {
      const button = [...document.querySelectorAll('.mode-seg button')].find((item) =>
        item.textContent.includes('多模型'),
      )
      button?.click()
    })
    await page.waitForSelector('.lyric-box', { timeout: 10000 })
    await page.evaluate(() => {
      const input = document.querySelector('.lyric-query')
      if (input) {
        input.value = '起风了 周深'
        input.dispatchEvent(new Event('input', { bubbles: true }))
      }
    })
    await page.evaluate(() => {
      document.querySelector('.lyric-btn')?.click()
    })
    await page.waitForSelector('.lyric-candidate', { timeout: 30000 })
    await page.evaluate(() => {
      document.querySelector('.lyric-candidate')?.click()
    })
    await page.waitForSelector('.lyric-status', { timeout: 30000 })
    await new Promise((resolve) => setTimeout(resolve, 800))
    console.log(
      'lyrics status',
      await page.evaluate(() => document.querySelector('.lyric-status span')?.textContent),
    )
    await page.evaluate(() => {
      document.querySelector('.lyric-box')?.scrollIntoView({ block: 'center' })
    })
    await new Promise((resolve) => setTimeout(resolve, 500))
    await snap(page, '22-lyrics')
    await page.close()
  },

  async devices(browser, context) {
    const page = await open(browser, context, 'create', '.create-card')
    await page.evaluate(() => {
      const toggle = [...document.querySelectorAll('.advanced-toggle')].find((item) =>
        item.textContent.includes('高级参数'),
      )
      toggle?.click()
    })
    await page.waitForSelector('.advanced-body', { timeout: 10000 })
    await new Promise((resolve) => setTimeout(resolve, 800))
    console.log(
      'devices',
      await page.evaluate(() =>
        [...document.querySelectorAll('.advanced-body .chip')].map((el) => el.textContent),
      ),
    )
    await page.evaluate(() => {
      document.querySelector('.advanced-body')?.scrollIntoView({ block: 'center' })
    })
    await new Promise((resolve) => setTimeout(resolve, 500))
    await snap(page, '23-devices')
    await page.close()
  },

  async offline(browser) {
    const page = await browser.newPage()
    await page.setViewport(VIEWPORT)
    await page.goto(`${BASE}/?server=${encodeURIComponent(BASE)}&key=demo-key#/tasks`, {
      waitUntil: 'domcontentloaded',
    })
    await page.waitForSelector('.task-card', { timeout: 20000 })
    await page.evaluate(() => {
      localStorage.setItem(
        'xb-svcb.mobile.config',
        JSON.stringify({ serverUrl: 'http://127.0.0.1:9', apiKey: 'broken-key' }),
      )
      location.replace(`${location.origin}/#/tasks`)
    })
    await page.waitForSelector('.connect-card', { timeout: 20000 })
    await new Promise((resolve) => setTimeout(resolve, 600))
    await snap(page, '24-offline')
    console.log(
      'offline fields',
      await page.evaluate(() => [
        document.querySelector('#server')?.value,
        Boolean(document.querySelector('.reconnect-note')),
      ]),
    )
    await page.close()
  },

  async materialdownload(browser, context) {
    const page = await open(browser, context, 'materials', '.material-card')
    await page.type('.online-input', '起风了')
    await page.evaluate(() => {
      document.querySelector('.online-btn')?.click()
    })
    await page.waitForSelector('.online-row', { timeout: 30000 })
    console.log(
      'online results',
      await page.evaluate(() => document.querySelectorAll('.online-row').length),
    )
    await page.evaluate(() => {
      document.querySelector('.download-pc')?.click()
    })
    await page.waitForFunction(
      () => [...document.querySelectorAll('.material-text b')].some((el) => el.textContent.includes('下载版')),
      { timeout: 30000 },
    )
    await new Promise((resolve) => setTimeout(resolve, 600))
    await snap(page, '26-material-download')
    await page.close()
  },

  async materialuse(browser, context) {
    const page = await open(browser, context, 'materials', '.material-card')
    await page.evaluate(() => {
      const button = [...document.querySelectorAll('.material-card .action')].find((item) =>
        item.textContent.includes('用于翻唱'),
      )
      button?.click()
    })
    await page.waitForSelector('.create-card', { timeout: 20000 })
    await page.waitForSelector('.upload-ok', { timeout: 30000 })
    await new Promise((resolve) => setTimeout(resolve, 700))
    console.log(
      'material song',
      await page.evaluate(() => document.querySelector('.song-info b')?.textContent),
    )
    await snap(page, '25-material-use')
    await page.close()
  },

  async hubflow(browser, context) {
    const page = await open(browser, context, 'models', '.voice-card')
    await page.evaluate(() => {
      const button = [...document.querySelectorAll('.tab')].find((item) => item.textContent.includes('模型站'))
      button?.click()
    })
    await page.waitForSelector('.hub-card', { timeout: 20000 })
    await page.evaluate(() => {
      document.querySelector('.hub-card .pill-btn')?.click()
    })
    await page.waitForSelector('.hub-progress', { timeout: 10000 })
    await new Promise((resolve) => setTimeout(resolve, 1500))
    await snap(page, '18-hub-download')
    await page.close()
  },

  async hub(browser, context) {
    const page = await open(browser, context, 'models', '.voice-card')
    await page.evaluate(() => {
      const button = [...document.querySelectorAll('.tab')].find((item) => item.textContent.includes('模型站'))
      button?.click()
    })
    await page.waitForSelector('.hub-card', { timeout: 20000 })
    await new Promise((resolve) => setTimeout(resolve, 900))
    await snap(page, '14-hub')
    await page.close()
  },

  async pymss(browser, context) {
    const page = await open(browser, context, 'models', '.voice-card')
    await page.evaluate(() => {
      const button = [...document.querySelectorAll('.tab')].find((item) => item.textContent.includes('PyMSS'))
      button?.click()
    })
    await page.waitForSelector('.pymss-row', { timeout: 20000 })
    await new Promise((resolve) => setTimeout(resolve, 1200))
    await snap(page, '05-pymss')
    await page.close()
  },

  async materials(browser, context) {
    const page = await open(browser, context, 'materials', '.material-card')
    await snap(page, '06-materials')
    await page.close()
  },

  async sheet(browser, context) {
    const page = await open(browser, context, 'tasks', '.task-card')
    await page.evaluate(() => {
      const cards = [...document.querySelectorAll('.task-card')]
      const done = cards.find((card) => card.querySelector('.badge--done'))
      done?.click()
    })
    await page.waitForSelector('.sheet', { timeout: 10000 })
    await new Promise((resolve) => setTimeout(resolve, 1200))
    await snap(page, '07-task-detail')
    await page.close()
  },

  async settings(browser, context) {
    const page = await open(browser, context, 'settings', '.group')
    await snap(page, '08-settings')
    await page.close()
  },

  async createflow(browser, context) {
    const page = await open(browser, context, 'create', '.create-card')
    const [chooser] = await Promise.all([page.waitForFileChooser(), page.click('.dropzone')])
    await chooser.accept([ensureSample()])
    await page.waitForSelector('.upload-ok', { timeout: 30000 })
    await page.evaluate(() => {
      const input = document.querySelector('#title')
      if (input) {
        input.value = ''
        input.dispatchEvent(new Event('input', { bubbles: true }))
      }
    })
    await page.type('#title', '起风了 · 手机创建')
    await page.evaluate(() => {
      document.querySelectorAll('.model-row')[1]?.click()
    })
    await new Promise((resolve) => setTimeout(resolve, 400))
    await snap(page, '10-create-filled')
    await page.evaluate(() => {
      document.querySelector('.submit')?.click()
    })
    await page.waitForFunction(() => location.hash === '#/tasks', { timeout: 20000 })
    await new Promise((resolve) => setTimeout(resolve, 1600))
    await snap(page, '11-task-created')
    console.log(await page.evaluate(() => document.querySelector('.task-card .title')?.textContent))
    await page.close()
  },

  async anime(browser, context) {
    const page = await open(browser, context, 'tasks', '.task-card')
    await page.evaluate(() => {
      document.documentElement.dataset.theme = 'anime'
      localStorage.setItem('xb-svcb.mobile.theme', 'anime')
    })
    await new Promise((resolve) => setTimeout(resolve, 500))
    await snap(page, '12-anime')
    await page.close()
  },

  async brand(browser, context) {
    const page = await open(browser, context, 'tasks', '.task-card')
    await page.evaluate(() => {
      document.documentElement.dataset.theme = 'brand'
      localStorage.setItem('xb-svcb.mobile.theme', 'brand')
    })
    await new Promise((resolve) => setTimeout(resolve, 500))
    await snap(page, '13-brand')
    await page.close()
  },

  async filemode(browser) {    const { pathToFileURL } = require('url')
    const page = await browser.newPage()
    page.on('pageerror', (error) => console.log(`pageerror: ${error.message}`))
    page.on('console', (message) => {
      if (message.type() === 'error') console.log(`console: ${message.text()}`)
    })
    await page.setViewport(VIEWPORT)
    await page.evaluateOnNewDocument(() => {
      localStorage.setItem(
        'xb-svcb.mobile.config',
        JSON.stringify({ serverUrl: 'http://127.0.0.1:8788', apiKey: 'demo-key' }),
      )
    })
    const file = pathToFileURL(path.resolve(__dirname, '..', 'web', 'dist', 'index.html')).href
    await page.goto(`${file}#/tasks`, { waitUntil: 'load' })
    await page.waitForSelector('.task-card', { timeout: 20000 })
    await page.addStyleTag({
      content: '*,*::before,*::after{animation-duration:.001s!important;animation-delay:0s!important;transition:none!important}',
    })
    await new Promise((resolve) => setTimeout(resolve, 1200))
    await snap(page, '09-filemode')
    await page.close()
  },
}

;(async () => {
  const requested = process.argv.slice(2)
  const names = requested.length ? requested : Object.keys(scenarios)
  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: true,
    userDataDir: path.join(__dirname, '.edge-data'),
    args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--hide-scrollbars', '--force-device-scale-factor=2', '--allow-file-access-from-files'],
  })
  const context = await browser.createBrowserContext()
  try {
    for (const name of names) {
      if (!scenarios[name]) {
        console.log(`skip unknown scenario ${name}`)
        continue
      }
      await scenarios[name](browser, context)
    }
  } finally {
    await context.close()
    await browser.close()
  }
})().catch((error) => {
  console.error(error)
  process.exit(1)
})
