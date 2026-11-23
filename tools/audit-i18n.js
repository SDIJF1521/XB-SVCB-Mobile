const path = require('path')
const puppeteer = require('puppeteer-core')

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = 'http://127.0.0.1:8788'
const CONNECT = `${BASE}/?server=${encodeURIComponent(BASE)}&key=demo-key`
const VIEWPORT = { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }

async function main() {
  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--allow-file-access-from-files'],
  })
  const context = browser.defaultBrowserContext()
  const page = await context.newPage()
  await page.setViewport(VIEWPORT)
  await page.goto(CONNECT, { waitUntil: 'domcontentloaded' })
  await page.evaluate(() => localStorage.setItem('xb-svcb.mobile.locale', 'en-US'))
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.task-card', { timeout: 20000 })

  for (const route of ['tasks', 'create', 'models', 'materials', 'settings']) {
    await page.evaluate((hash) => (location.hash = `#/${hash}`), route)
    await new Promise((resolve) => setTimeout(resolve, 900))
    if (route === 'create') {
      await page.evaluate(() => {
        document.querySelectorAll('.advanced-toggle')[0]?.click()
        const blocks = [...document.querySelectorAll('.setting-block')]
        const ai = blocks.find((item) => item.textContent.includes('AI'))
        ai?.querySelector('.switch')?.click()
      })
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
    const values = await page.evaluate(() => {
      const out = []
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
      let node = walker.nextNode()
      while (node) {
        const text = node.data.replace(/\s+/g, ' ').trim()
        if (text && /[\u4e00-\u9fff]/.test(text)) {
          const el = node.parentElement
          const cls = el ? `${el.tagName}.${(el.className || '').toString().split(' ').slice(0, 2).join('.')}` : ''
          out.push(`${cls} :: ${text}`)
        }
        node = walker.nextNode()
      }
      return [...new Set(out)]
    })
    console.log(`\n--- ${route} ---`)
    console.log(values.join('\n'))
  }
  await browser.close()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
