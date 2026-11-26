/**
 * 多机型视口截图 + 布局测量，用于校验各页面在安卓屏幕上的自适应表现。
 *
 * 用法：node tools/shoot-sizes.js [tag] [scenario...]
 * 前置：node tools/mock-server.js 已启动，web 已构建。
 */
const fs = require('fs')
const path = require('path')
const puppeteer = require('puppeteer-core')

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = 'http://127.0.0.1:8788'
const CONNECT = `${BASE}/?server=${encodeURIComponent(BASE)}&key=demo-key`
const tag = process.argv[2] || 'cur'
const OUT = path.resolve(__dirname, '..', '.screenshots', 'sizes', tag)

const VIEWPORTS = [
  { name: '320x568', width: 320, height: 568 },
  { name: '360x640', width: 360, height: 640 },
  { name: '360x780', width: 360, height: 780 },
  { name: '390x844', width: 390, height: 844 },
  { name: '412x915', width: 412, height: 915 },
  { name: 'landscape-780x360', width: 780, height: 360 },
]

const SCENARIOS = {
  connect: { url: BASE, wait: '.connect-card' },
  tasks: { url: `${CONNECT}#/tasks`, wait: '.task-card' },
  settings: { url: `${CONNECT}#/settings`, wait: '.group' },
  models: { url: `${CONNECT}#/models`, wait: '.voice-card' },
  create: { url: `${CONNECT}#/create`, wait: '.create-card' },
  materials: { url: `${CONNECT}#/materials`, wait: '.material-card' },
}

/** 读出用于对比的关键尺寸。 */
const MEASURE = () => {
  const pick = (selector) => document.querySelector(selector)
  const rect = (el) => (el ? el.getBoundingClientRect() : null)
  const style = (el) => (el ? getComputedStyle(el) : null)
  const shell = pick('.app-shell')
  const main = pick('.app-main') || pick('.connect-page')
  const title = pick('.page-title') || pick('h1')
  const scroller = pick('.app-main') || pick('.connect-page')
  return {
    viewport: { w: innerWidth, h: innerHeight },
    shellH: shell ? shell.getBoundingClientRect().height : null,
    docScrollH: document.documentElement.scrollHeight,
    scrollerClientH: scroller ? scroller.clientHeight : null,
    scrollerScrollH: scroller ? scroller.scrollHeight : null,
    overflowY: scroller ? scroller.scrollHeight - scroller.clientHeight : null,
    horizontalOverflow: document.documentElement.scrollWidth - innerWidth,
    titleFont: title ? style(title).fontSize : null,
    titleBox: rect(title) ? Math.round(rect(title).width) : null,
    cardPad: (() => {
      const card = pick('.glass')
      return card ? style(card).padding : null
    })(),
    bodyFont: style(document.body).fontSize,
    navH: (() => {
      const nav = pick('.tabbar') || pick('nav')
      return nav ? Math.round(nav.getBoundingClientRect().height) : null
    })(),
    headerH: (() => {
      const header = pick('.app-header')
      return header ? Math.round(header.getBoundingClientRect().height) : null
    })(),
  }
}

async function shoot(page, viewport, name) {
  const file = path.join(OUT, `${name}--${viewport.name}.png`)
  await page.screenshot({ path: file })
  return file
}

;(async () => {
  const requested = process.argv.slice(3)
  const names = requested.length ? requested : Object.keys(SCENARIOS)
  fs.mkdirSync(OUT, { recursive: true })
  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: true,
    userDataDir: path.join(__dirname, '.edge-data'),
    args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--hide-scrollbars'],
  })
  const report = {}
  try {
    for (const viewport of VIEWPORTS) {
      const context = await browser.createBrowserContext()
      for (const name of names) {
        const scenario = SCENARIOS[name]
        if (!scenario) {
          console.log(`skip unknown scenario ${name}`)
          continue
        }
        const page = await context.newPage()
        const errors = []
        page.on('pageerror', (error) => errors.push(error.message))
        await page.setViewport({
          width: viewport.width,
          height: viewport.height,
          deviceScaleFactor: 2,
          isMobile: true,
          hasTouch: true,
        })
        await page.goto(scenario.url, { waitUntil: 'domcontentloaded', timeout: 45000 })
        try {
          await page.waitForSelector(scenario.wait, { timeout: 20000 })
        } catch {
          console.log(`miss ${name} @ ${viewport.name}`)
        }
        await page.addStyleTag({
          content:
            '*,*::before,*::after{animation-duration:.001s!important;animation-delay:0s!important;transition:none!important}',
        })
        await new Promise((resolve) => setTimeout(resolve, 900))
        const info = await page.evaluate(MEASURE)
        report[`${name}@${viewport.name}`] = { ...info, errors }
        await shoot(page, viewport, name)
        await page.close()
      }
      await context.close()
    }
  } finally {
    await browser.close()
  }
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2))
  for (const [key, value] of Object.entries(report)) {
    console.log(
      key.padEnd(28),
      `title=${value.titleFont}`.padEnd(18),
      `cardPad=${value.cardPad}`.padEnd(30),
      `scroll=${value.overflowY}/${value.scrollerClientH}`.padEnd(22),
      `xOverflow=${value.horizontalOverflow}`,
    )
  }
})().catch((error) => {
  console.error(error)
  process.exit(1)
})
