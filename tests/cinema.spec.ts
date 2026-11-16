import { expect, test } from '@playwright/test'

test('scroll changes every chapter, reverses, and keeps the 3D canvas mounted', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  await expect(page.locator('canvas')).toBeVisible()
  await expect(page.locator('canvas')).toHaveAttribute('data-model', 'memory-page-volume')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('全栈构建')
  const canvas = await page.locator('canvas').elementHandle()
  for (const chapter of [1, 2, 3, 4, 0]) {
    await page.evaluate((index) => window.scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * index / 4), chapter)
    await expect(page.locator('.cinema-stage')).toHaveAttribute('data-chapter', String(chapter))
    await expect(page.locator('.chapter').nth(chapter)).toHaveAttribute('aria-hidden', 'false')
    await expect(page.locator('canvas')).toHaveAttribute('data-present', chapter >= 3 ? '1' : '0')
    await expect(page.locator('canvas')).toHaveAttribute('data-resident', chapter >= 2 ? '1' : '0')
    expect(await canvas?.evaluate((node) => node.isConnected)).toBe(true)
  }
  await page.locator('.model-toggle').click()
  await expect(page.locator('.model-toggle')).toHaveAttribute('aria-pressed', 'true')
  await page.screenshot({ path: '.artifacts/desktop.png' })
  expect(errors).toEqual([])
})

test('chapter controls, motion controls and legal dialog work', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '跳到就绪', exact: true }).click()
  await expect(page.locator('.cinema-stage')).toHaveAttribute('data-chapter', '2')
  await expect(page).toHaveURL(/#resident$/)
  // Scrolling beyond a linked chapter must not jump back when motion is toggled.
  await page.evaluate(() => window.scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * 3 / 4))
  await expect(page.locator('.cinema-stage')).toHaveAttribute('data-chapter', '3')
  await page.getByRole('button', { name: '暂停动效', exact: true }).click()
  await expect(page.locator('.cinema-stage')).toHaveAttribute('data-motion', 'paused')
  await expect(page.locator('.cinema-stage')).toHaveAttribute('data-chapter', '3')
  await page.getByRole('button', { name: '隐私', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await page.getByRole('button', { name: '开启动效', exact: true }).click()
  await expect(page.locator('.cinema-stage')).toHaveAttribute('data-motion', 'full')
})

test('drag and keyboard rotate the 3D model, and reset restores its view', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  const canvas = page.locator('canvas')
  await expect(canvas).toHaveAttribute('data-user-yaw', '0.0000')
  const bounds = (await canvas.boundingBox())!
  const x = bounds.x + bounds.width * 0.62, y = bounds.y + bounds.height * 0.48
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + 140, y + 60, { steps: 12 })
  await expect(canvas).toHaveAttribute('data-dragging', 'true')
  await page.mouse.up()
  await expect(canvas).toHaveAttribute('data-dragging', 'false')
  await expect.poll(async () => Number(await canvas.getAttribute('data-user-yaw'))).toBeGreaterThan(1)
  await expect.poll(async () => Number(await canvas.getAttribute('data-user-pitch'))).toBeGreaterThan(0.3)
  expect(await page.evaluate(() => scrollY)).toBe(0)
  await expect(page.locator('.model-toggle')).toHaveAttribute('aria-pressed', 'false')
  await page.screenshot({ path: '.artifacts/model-rotated.png' })
  await page.getByRole('button', { name: '重置视角' }).click()
  await expect.poll(async () => Math.abs(Number(await canvas.getAttribute('data-user-yaw')))).toBeLessThan(0.01)
  await canvas.focus()
  await page.keyboard.press('ArrowRight')
  await expect.poll(async () => Number(await canvas.getAttribute('data-user-yaw'))).toBeGreaterThan(0.13)
  await page.keyboard.press('r')
  await expect.poll(async () => Math.abs(Number(await canvas.getAttribute('data-user-yaw')))).toBeLessThan(0.01)
})

test('scroll and chapter navigation gradually move the same model', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  const canvas = page.locator('canvas')
  await expect(canvas).toHaveAttribute('data-model-progress', '0.00000')
  // Wheel events over the canvas still drive native page scrolling.
  const bounds = (await canvas.boundingBox())!
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
  await page.mouse.wheel(0, 850)
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(700)
  await expect.poll(async () => Number(await canvas.getAttribute('data-model-progress'))).toBeGreaterThan(0.05)
  await page.evaluate(() => window.scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * 3 / 4))
  await expect(page.locator('.cinema-stage')).toHaveAttribute('data-chapter', '3')
  const before = Number(await canvas.getAttribute('data-model-progress'))
  expect(before).toBeLessThan(0.65)
  const rotationBefore = Number(await canvas.getAttribute('data-rotation-y'))
  await expect.poll(async () => Number(await canvas.getAttribute('data-model-progress'))).toBeGreaterThan(0.73)
  expect(Math.abs(Number(await canvas.getAttribute('data-rotation-y')) - rotationBefore)).toBeGreaterThan(0.5)
  await page.getByRole('button', { name: '跳到访问', exact: true }).click()
  await expect(page.locator('.cinema-stage')).toHaveAttribute('data-chapter', '0')
  await expect.poll(async () => Number(await canvas.getAttribute('data-model-progress'))).toBeLessThan(0.01)
})

test('pausing retains the current pose and resuming eases toward the scrolled chapter', async ({ page }) => {
  await page.goto('/')
  const canvas = page.locator('canvas')
  await expect(canvas).toHaveAttribute('data-model-progress', '0.00000')
  await page.evaluate(() => scrollTo(0, (document.documentElement.scrollHeight - innerHeight) / 8))
  await expect.poll(async () => Number(await canvas.getAttribute('data-model-progress'))).toBeGreaterThan(0.04)
  await page.getByRole('button', { name: '暂停动效', exact: true }).click()
  await expect(page.locator('.cinema-stage')).toHaveAttribute('data-motion', 'paused')
  const frozen = await canvas.evaluate((node) => ({ progress: node.dataset.modelProgress, rotation: node.dataset.rotationY }))
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight - innerHeight))
  await expect(page.locator('.cinema-stage')).toHaveAttribute('data-chapter', '4')
  expect(await canvas.getAttribute('data-model-progress')).toBe(frozen.progress)
  expect(await canvas.getAttribute('data-rotation-y')).toBe(frozen.rotation)
  await page.getByRole('button', { name: '开启动效', exact: true }).click()
  const samples = await canvas.evaluate(async (node) => {
    const samples: { time: number, rotation: number }[] = []
    const start = performance.now()
    await new Promise<void>((resolve) => {
      const tick = (now: number) => {
        samples.push({ time: now, rotation: Number(node.dataset.rotationY) })
        if (now - start < 1800) requestAnimationFrame(tick)
        else resolve()
      }
      requestAnimationFrame(tick)
    })
    return samples
  })
  expect(new Set(samples.map((sample) => sample.rotation)).size).toBeGreaterThan(8)
  const angularSteps = samples.slice(1).map((sample, i) => Math.abs(sample.rotation - samples[i].rotation))
  expect(Math.max(...angularSteps)).toBeLessThan(0.25)
  expect(Math.abs(samples.at(-1)!.rotation - samples[0].rotation)).toBeGreaterThan(0.5)
})

test('model and shadows remain complete when the structure expands and rotates', async ({ page }) => {
  test.setTimeout(90_000)
  const verifyPaint = async () => {
    const paint = await page.locator('canvas').evaluate((node) => new Promise<{ width: number, height: number, left: number, top: number, right: number, bottom: number, count: number }>((resolve) => requestAnimationFrame(() => {
      const source = node as HTMLCanvasElement
      const sample = document.createElement('canvas')
      sample.width = source.width; sample.height = source.height
      const context = sample.getContext('2d')!
      context.drawImage(source, 0, 0)
      const pixels = context.getImageData(0, 0, sample.width, sample.height).data
      let left = sample.width, top = sample.height, right = 0, bottom = 0, count = 0
      for (let y = 0; y < sample.height; y++) for (let x = 0; x < sample.width; x++) {
        if (pixels[(y * sample.width + x) * 4 + 3] <= 2) continue
        left = Math.min(left, x); right = Math.max(right, x)
        top = Math.min(top, y); bottom = Math.max(bottom, y); count++
      }
      resolve({ width: sample.width, height: sample.height, left, top, right, bottom, count })
    })))
    expect(paint.count).toBeGreaterThan(1000)
    expect(paint.left).toBeGreaterThan(4)
    expect(paint.top).toBeGreaterThan(4)
    expect(paint.right).toBeLessThan(paint.width - 5)
    expect(paint.bottom).toBeLessThan(paint.height - 5)
  }
  for (const [width, height] of [[1440, 900], [390, 844]]) {
    await page.setViewportSize({ width, height })
    await page.goto('/')
    const canvas = page.locator('canvas')
    await expect(canvas).toHaveAttribute('data-model', 'memory-page-volume')
    await page.getByRole('button', { name: '展开结构', exact: true }).click()
    await expect.poll(async () => Number(await canvas.getAttribute('data-expansion'))).toBeGreaterThan(.64)
    for (const chapter of [0, 3]) {
      await page.evaluate((i) => scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * i / 4), chapter)
      await expect.poll(async () => Math.abs(Number(await canvas.getAttribute('data-model-progress')) - chapter / 4)).toBeLessThan(.003)
      await verifyPaint()
      if (chapter === 3) {
        await canvas.focus()
        for (let turn = 0; turn < 4; turn++) await page.keyboard.press('Shift+ArrowRight')
        await expect.poll(async () => Number(await canvas.getAttribute('data-user-yaw'))).toBeGreaterThan(1.18)
        await verifyPaint()
      }
    }
  }
})

test('mobile layout fits and the full screen menu navigates', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await expect(page.locator('canvas')).toBeVisible()
  const dimensions = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }))
  expect(dimensions.scroll).toBe(dimensions.width)
  await expect(page.locator('.chapter--first .github-link')).toBeInViewport()
  await page.screenshot({ path: '.artifacts/mobile.png' })
  await page.getByRole('button', { name: '打开菜单' }).click()
  await expect(page.locator('#mobile-menu')).toHaveAttribute('aria-hidden', 'false')
  await page.locator('#mobile-menu').getByRole('link', { name: '04 映射' }).click()
  await expect(page.locator('.cinema-stage')).toHaveAttribute('data-chapter', '3')
  await expect(page.locator('#mobile-menu')).toHaveAttribute('aria-hidden', 'true')
})

test.describe('mobile touch and small viewports', () => {
  test.use({ isMobile: true, hasTouch: true, deviceScaleFactor: 1.5 })

  test('all chapters and controls fit small phones, tablets and landscape', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')
    for (const [width, height] of [[320, 568], [390, 667], [768, 1024], [844, 390], [568, 320]]) {
      await page.setViewportSize({ width, height })
      for (let chapter = 0; chapter < 5; chapter++) {
        await page.getByRole('button', { name: `跳到${['访问', '缺页', '就绪', '映射', '继续'][chapter]}`, exact: true }).click()
        await expect(page.locator('.cinema-stage')).toHaveAttribute('data-chapter', String(chapter))
        const layout = await page.evaluate((i) => {
          const chapter = document.querySelectorAll('.chapter')[i]
          const heading = chapter.querySelector('h1, h2')!.getBoundingClientRect()
          const copy = chapter.querySelector('.chapter-copy')!.getBoundingClientRect()
          const frame = document.querySelector('.scene-zone:not(.static-memory)')!.getBoundingClientRect()
          const bottom = document.querySelector('.cinema-bottom')!.getBoundingClientRect()
          const header = document.querySelector('.navigation')!.getBoundingClientRect()
          const targets = [...document.querySelectorAll('.model-controls button, .timeline-step, .menu-toggle')].map((node) => node.getBoundingClientRect().height)
          return { width: innerWidth, scrollWidth: document.documentElement.scrollWidth, viewport: innerHeight, headingTop: heading.top, headingBottom: heading.bottom, copyTop: copy.top, copyBottom: copy.bottom, frameTop: frame.top, frameBottom: frame.bottom, footerTop: bottom.top, footerBottom: bottom.bottom, headerBottom: header.bottom, targets, portrait: innerHeight > innerWidth }
        }, chapter)
        expect(layout.scrollWidth).toBe(layout.width)
        expect(layout.headingTop).toBeGreaterThanOrEqual(layout.headerBottom)
        expect(layout.copyBottom).toBeLessThanOrEqual(layout.footerTop)
        expect(layout.footerBottom).toBeLessThanOrEqual(layout.viewport)
        expect(Math.min(...layout.targets)).toBeGreaterThanOrEqual(48)
        if (layout.portrait) {
          expect(layout.headingBottom).toBeLessThanOrEqual(layout.frameTop)
          expect(layout.frameBottom).toBeLessThanOrEqual(layout.copyTop)
        }
      }
    }
    await page.getByRole('button', { name: '打开菜单' }).click()
    await page.locator('#mobile-menu').getByRole('link', { name: '04 映射' }).click()
    await expect(page.locator('#mobile-menu')).toHaveAttribute('aria-hidden', 'true')
    await expect(page.locator('.cinema-stage')).toHaveAttribute('data-chapter', '3')
    await page.getByRole('button', { name: '打开菜单' }).click()
    await page.getByRole('button', { name: '隐私', exact: true }).click()
    await expect(page.getByRole('dialog', { name: '页面导航' })).toHaveAttribute('aria-hidden', 'false')
    await expect(page.locator('#legal-dialog')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator('#legal-dialog')).not.toBeVisible()
  })

  test('touch drags rotate horizontally while vertical swipes scroll the page', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')
    const canvas = page.locator('canvas')
    await expect(canvas).toHaveAttribute('data-model', 'memory-page-volume')
    const bounds = (await page.locator('.scene-zone:not(.static-memory)').boundingBox())!
    const client = await page.context().newCDPSession(page)
    const swipe = async (x: number, y: number, dx: number, dy: number) => {
      await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
      for (let step = 1; step <= 10; step++) {
        await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + dx * step / 10, y: y + dy * step / 10 }] })
        await page.waitForTimeout(20)
      }
      await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    }
    await swipe(100, bounds.y + bounds.height / 2, 150, 0)
    await expect.poll(async () => Number(await canvas.getAttribute('data-user-yaw'))).toBeGreaterThan(0.9)
    expect(await page.evaluate(() => scrollY)).toBe(0)
    await swipe(195, bounds.y + bounds.height * .85, 0, -160)
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(80)
    await expect(canvas).toHaveAttribute('data-dragging', 'false')
  })
})

test('reduced motion respects the OS and deep links open the right chapter', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/#mapping')
  await expect(page.locator('.cinema-stage')).toHaveAttribute('data-chapter', '3')
  await expect(page.locator('.cinema-stage')).toHaveAttribute('data-motion', 'reduced')
  await expect(page.getByRole('button', { name: '已遵循系统减少动态效果设置' })).toBeDisabled()
  await expect(page.locator('.reveal-word').first()).toHaveCSS('opacity', '1')
  await expect(page.locator('canvas')).toHaveAttribute('data-present', '1')
})

test('fault, residency and a valid mapping are distinct steps', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/#fault')
  await expect(page.locator('.scene-zone')).toHaveAttribute('data-memory-state', 'PAGE FAULT')
  await expect(page.locator('canvas')).toHaveAttribute('data-present', '0')
  await expect(page.locator('canvas')).toHaveAttribute('data-resident', '0')
  await page.getByRole('button', { name: '跳到就绪', exact: true }).click()
  await expect(page.locator('canvas')).toHaveAttribute('data-resident', '1')
  await expect(page.locator('canvas')).toHaveAttribute('data-present', '0')
  await page.getByRole('button', { name: '跳到映射', exact: true }).click()
  await expect(page.locator('canvas')).toHaveAttribute('data-present', '1')
  await page.getByRole('button', { name: '跳到继续', exact: true }).click()
  await expect(page.locator('.scene-zone')).toHaveAttribute('data-memory-state', 'EXECUTION RESUMED')
  await expect(page.locator('canvas')).toHaveAttribute('data-present', '1')
})

test.describe('high DPI rendering', () => {
  test.use({ deviceScaleFactor: 2.5, viewport: { width: 390, height: 844 } })

  test('canvas preserves display resolution without adding visual clutter', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('canvas')).toHaveAttribute('data-model', 'memory-page-volume')
    const resolution = await page.locator('canvas').evaluate((canvas) => {
      const bounds = canvas.getBoundingClientRect()
      const target = canvas as HTMLCanvasElement
      return { x: target.width / bounds.width, y: target.height / bounds.height }
    })
    expect(resolution.x).toBeCloseTo(2.5, 1)
    expect(resolution.y).toBeCloseTo(2.5, 1)
    await expect(page.locator('nav[aria-label="故事进度"]')).toHaveCount(1)
    await expect(page.getByRole('button', { name: '重置视角' })).toBeVisible()
    for (const text of ['VIRTUAL → PHYSICAL', 'FULL STACK / OPEN SOURCE', 'MADE TO BE SHARED', '发现代码', '交流想法', '参与贡献']) {
      await expect(page.getByText(text, { exact: true })).toHaveCount(0)
    }
  })
})

test('unknown paths show a branded return route', async ({ page }) => {
  await page.goto('/a-missing-page')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('尚未写下')
  await expect(page.getByRole('link', { name: '返回首页' })).toHaveAttribute('href', '/')
})
