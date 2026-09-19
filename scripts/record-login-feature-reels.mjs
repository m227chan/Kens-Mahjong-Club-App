/**
 * Records login feature reels from the animated splash demos (CSS mockups).
 * Usage: node scripts/record-login-feature-reels.mjs
 * Requires the Next dev server on http://localhost:3000
 *
 * Captures at 2× device scale so the MP4s stay sharp when scaled up in the UI.
 */
import { mkdir, writeFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'
import puppeteer from 'puppeteer'
import ffmpegPath from '@ffmpeg-installer/ffmpeg'

const BASE = process.env.FEATURE_REEL_BASE ?? 'http://localhost:3000/login/?record=1'
const OUT_DIR = path.resolve('public/feature-reels')
const FEATURES = ['session', 'calculator', 'standings', 'clubs']
const ONLY = process.env.FEATURE_REEL_ONLY?.split(',')
  .map((value) => value.trim())
  .filter(Boolean)
const RECORD_FEATURES = ONLY?.length
  ? FEATURES.filter((id) => ONLY.includes(id))
  : FEATURES
if (!RECORD_FEATURES.length) {
  console.error(`No matching features for FEATURE_REEL_ONLY=${process.env.FEATURE_REEL_ONLY}`)
  process.exit(1)
}
const FRAME_MS = 100
const DURATION_MS = 6500
const VIEWPORT = { width: 1440, height: 960, deviceScaleFactor: 2 }

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath.path, args, { stdio: 'inherit' })
    child.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`ffmpeg exited with ${code}`))
    })
  })
}

async function recordFeature(browser, feature, index) {
  const page = await browser.newPage()
  await page.setViewport(VIEWPORT)
  await page.goto(BASE, { waitUntil: 'networkidle0', timeout: 60000 })
  await page.waitForSelector('.lfs')
  await page.evaluate(() => {
    document.querySelector('#how-it-works')?.scrollIntoView({ block: 'start' })
  })
  await new Promise((r) => setTimeout(r, 400))

  const tabs = await page.$$('.lfs-tabs button')
  if (!tabs[index]) throw new Error(`Missing tab for ${feature}`)
  await tabs[index].click()
  await new Promise((r) => setTimeout(r, 200))

  const frameDir = path.join(OUT_DIR, `_frames_${feature}`)
  await rm(frameDir, { recursive: true, force: true })
  await mkdir(frameDir, { recursive: true })

  const handle = await page.$('.lfs-panels [role="tabpanel"]:not([hidden]) .lfs-reel-frame')
  if (!handle) throw new Error('Reel frame not found')
  await page.evaluate((el) => el.scrollIntoView({ block: 'center' }), handle)

  // Force a large capture box so 2× screenshots stay sharp on desktop.
  await page.evaluate((el) => {
    el.style.width = '640px'
    el.style.minHeight = '420px'
    el.style.maxWidth = 'none'
  }, handle)

  const frames = Math.ceil(DURATION_MS / FRAME_MS)
  for (let i = 0; i < frames; i++) {
    const file = path.join(frameDir, `frame-${String(i).padStart(4, '0')}.png`)
    await handle.screenshot({ path: file, type: 'png' })
    await new Promise((r) => setTimeout(r, FRAME_MS))
  }

  const outFile = path.join(OUT_DIR, `${feature}.mp4`)
  await runFfmpeg([
    '-y',
    '-framerate',
    String(Math.round(1000 / FRAME_MS)),
    '-i',
    path.join(frameDir, `frame-%04d.png`),
    '-vf',
    'scale=trunc(iw/2)*2:trunc(ih/2)*2',
    '-c:v',
    'libx264',
    '-preset',
    'slow',
    '-crf',
    '18',
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    outFile,
  ])

  await rm(frameDir, { recursive: true, force: true })
  await page.close()
  return outFile
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true })
  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: null,
    args: ['--no-sandbox', '--font-render-hinting=none', '--disable-lcd-text'],
  })
  try {
    const written = []
    for (const feature of RECORD_FEATURES) {
      const index = FEATURES.indexOf(feature)
      const file = await recordFeature(browser, feature, index)
      written.push(file)
      console.log('Wrote', file)
    }
    await writeFile(
      path.join(OUT_DIR, 'manifest.json'),
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          source: BASE,
          capture: VIEWPORT,
          videos: FEATURES.map((id) => ({ id, src: `/feature-reels/${id}.mp4` })),
        },
        null,
        2,
      ),
    )
    console.log('Done:', written.length, 'videos')
  } finally {
    await browser.close()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
