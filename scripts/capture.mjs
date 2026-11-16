import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'

// Run pnpm dev first. --review also saves chapter and responsive screenshots.
const browser = await chromium.launch({ channel: 'chrome', args: ['--enable-unsafe-swiftshader'] })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
  await page.goto(process.env.PAGEFAULT_PREVIEW_URL || 'http://127.0.0.1:5173')
  await page.locator('canvas').waitFor()
  await page.evaluate(() => document.fonts.ready)
  const settle = async (progress) => {
    await page.waitForFunction((target) => Math.abs(Number(document.querySelector('canvas')?.dataset.modelProgress) - target) < 0.004, progress, { timeout: 12000 })
    await page.waitForTimeout(400)
  }
  if (process.argv.includes('--review')) {
    await mkdir('.artifacts', { recursive: true })
    for (let chapter = 0; chapter < 5; chapter++) {
      await page.evaluate((i) => window.scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * i / 4), chapter)
      await settle(chapter / 4)
      await page.screenshot({ path: `.artifacts/chapter-${chapter + 1}.png` })
    }
    for (const [width, height] of [[390, 844], [390, 667], [768, 1024], [1920, 1080]]) {
      await page.setViewportSize({ width, height })
      await page.evaluate(() => window.scrollTo(0, 0))
      await settle(0)
      await page.screenshot({ path: `.artifacts/viewport-${width}-${height}.png` })
    }
  }
  await page.setViewportSize({ width: 1200, height: 630 })
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.addStyleTag({ content: `
    .site-header, .cinema-bottom, .model-controls { display: none !important; }
    .cinema-stage { min-height: 630px; }
    .story-content { top: 22%; bottom: 10%; left: 7%; width: 47%; }
    .scene-frame { top: 0; bottom: 32px; left: 44%; right: 16px; }
    .chapter .heading-1 { font-size: 60px; line-height: 60px; }
    .og-brand { position: absolute; top: 36px; left: 7%; display: flex; align-items: center; gap: 8px; font: 600 24px 'Geist Variable', sans-serif; letter-spacing: -1px; }
  ` })
  await page.evaluate(() => {
    const brand = document.createElement('div')
    brand.className = 'og-brand'
    const mark = document.createElement('img')
    mark.src = '/pagefault.svg'
    mark.width = 32; mark.height = 32; mark.alt = ''
    brand.append(mark, 'PageFault.')
    document.querySelector('.cinema-stage').append(brand)
  })
  await settle(0)
  await page.screenshot({ path: 'public/og-image.png' })
  console.log('Saved public/og-image.png (1200 × 630).')
} finally {
  await browser.close()
}
