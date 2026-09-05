/**
 * Headless smoke check for the map render path, driven over raw CDP so it
 * needs no Playwright dependency. Verifies that the MapLibre worker parses the
 * GeoJSON sources (the failure that showed up only in production builds) and
 * reports console errors plus failed requests.
 *
 * Usage: node scripts/verify-map.mjs [url] [screenshot.png]
 */
import { spawn } from 'node:child_process'
import { spawnSync } from 'node:child_process'
import { existsSync, globSync, mkdirSync, mkdtempSync, realpathSync, rmSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const URL_UNDER_TEST = process.argv[2] ?? 'http://localhost:4174/'

/** Set CHROME_PATH to override; otherwise probe the usual install locations. */
function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH
  const candidates = [
    ...globSync(join(homedir(), 'AppData/Local/ms-playwright/chromium-*/chrome-win64/chrome.exe')),
    ...globSync(join(homedir(), '.cache/ms-playwright/chromium-*/chrome-linux/chrome')),
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ]
  const hit = candidates.find((p) => existsSync(p))
  if (!hit) throw new Error('no Chrome found; set CHROME_PATH to a Chrome/Chromium binary')
  return hit
}

const CHROME = findChrome()

const PORT = Number(process.env.CDP_PORT ?? 9412)
// Keep generated profiles inside the repo but outside Vite's watched files.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const temp = join(root, 'node_modules', '.cache', 'timesphere-browser')
mkdirSync(temp, { recursive: true })
const profile = realpathSync(mkdtempSync(join(temp, 'tsphere-')))

// On Windows the launcher process exits immediately while the real browser
// keeps running, so the ws endpoint is discovered over HTTP rather than stderr.
const child = spawn(
  CHROME,
  [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--disable-background-networking',
    // Software GL: headless has no real GPU, but MapLibre requires WebGL2.
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--hide-scrollbars',
    '--window-size=1440,900',
    `--user-data-dir=${profile}`,
    'about:blank',
  ],
  { stdio: 'ignore', detached: true, windowsHide: true },
)
child.unref()

/**
 * Cleanup must survive throws and signals, not just the happy path: a leaked
 * headless Chrome keeps the CDP port bound and its profile dir costs ~30MB.
 * Windows also holds file locks briefly after close, so removal is retried.
 */
let cleanedUp = false
function cleanup() {
  if (cleanedUp) return
  cleanedUp = true
  try {
    if (process.platform === 'win32') {
      // Chrome's launcher exits and re-spawns the browser outside the original
      // process tree, so taskkill /T /PID cannot reach it. The mkdtemp profile
      // path is unique per run, making it a safe and precise kill filter that
      // never touches a concurrent run or the user's own Chrome.
      // Match on the mkdtemp basename only: it is random alphanumerics, so it
      // carries no PowerShell -like wildcards ([ ] * ?) that a full temp path
      // (which embeds the username) could.
      const literal = `'${basename(profile).replace(/'/g, "''")}'`
      spawnSync(
        'powershell.exe',
        [
          '-NoProfile',
          '-Command',
          `Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" |` +
            ` Where-Object { $_.CommandLine -like ('*' + ${literal} + '*') } |` +
            ` ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`,
        ],
        { stdio: 'ignore', windowsHide: true },
      )
    } else {
      process.kill(-child.pid, 'SIGKILL')
    }
  } catch {}
  for (let i = 0; i < 10; i++) {
    try {
      if (dirname(profile) !== realpathSync(temp) || !basename(profile).startsWith('tsphere-')) {
        throw new Error('refusing to remove an unexpected browser profile')
      }
      rmSync(profile, { recursive: true, force: true })
      break
    } catch {
      spawnSync(process.execPath, ['-e', 'setTimeout(() => {}, 200)'], { stdio: 'ignore' })
    }
  }
}

process.on('exit', cleanup)
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(sig, () => {
    cleanup()
    process.exit(130)
  })
}
process.on('uncaughtException', (err) => {
  console.error(err)
  cleanup()
  process.exit(1)
})
process.on('unhandledRejection', (err) => {
  console.error(err)
  cleanup()
  process.exit(1)
})

const endpoint = await (async () => {
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 500))
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`)
      const json = await res.json()
      if (json.webSocketDebuggerUrl) return json.webSocketDebuggerUrl
    } catch {}
  }
  throw new Error('chrome never exposed a CDP endpoint')
})()

let nextId = 0
const pending = new Map()
const consoleErrors = []
const failedRequests = []

const ws = new WebSocket(endpoint)
await new Promise((res, rej) => {
  ws.onopen = res
  ws.onerror = () => rej(new Error('cannot open CDP socket'))
})

ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data)
  if (msg.id !== undefined) {
    const p = pending.get(msg.id)
    if (!p) return
    pending.delete(msg.id)
    clearTimeout(p.timer)
    msg.error ? p.reject(new Error(msg.error.message)) : p.resolve(msg.result)
    return
  }
  if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
    consoleErrors.push(msg.params.args.map((a) => a.value ?? a.description ?? '').join(' '))
  }
  if (msg.method === 'Runtime.exceptionThrown') {
    const d = msg.params.exceptionDetails
    consoleErrors.push(d.exception?.description ?? d.text)
  }
  if (msg.method === 'Network.loadingFailed') {
    failedRequests.push(`${msg.params.type} ${msg.params.errorText}`)
  }
}

const send = (method, params, sessionId) =>
  new Promise((resolve, reject) => {
    const id = ++nextId
    const timer = setTimeout(() => {
      pending.delete(id)
      reject(new Error('CDP timeout: ' + method))
    }, 30000)
    pending.set(id, { resolve, reject, timer })
    ws.send(JSON.stringify({ id, method, params, sessionId }))
  })

// Attach to a real tab so page-scoped domains are available.
const { targetId } = await send('Target.createTarget', { url: 'about:blank' })
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true })
const call = (method, params) => send(method, params, sessionId)

await call('Page.enable')
await call('Runtime.enable')
await call('Network.enable')
await call('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })

const loaded = new Promise((resolve) => {
  const onLoad = (ev) => {
    const msg = JSON.parse(ev.data)
    if (msg.method === 'Page.loadEventFired') resolve()
  }
  ws.addEventListener('message', onLoad)
})
const navigation = await call('Page.navigate', { url: URL_UNDER_TEST })
if (navigation.errorText) throw new Error('Navigation failed: ' + navigation.errorText)
await loaded

const evaluate = async (expression) => {
  const response = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description ?? response.exceptionDetails.text)
  return response.result.value
}
const pause = (ms = 250) => new Promise((r) => setTimeout(r, ms))
const checks = []
const check = (name, passed, detail) => {
  checks.push({ name, passed: Boolean(passed), detail })
}

// The map is intentionally below the complete city list.
await evaluate(`document.querySelector('.map-wrap')?.scrollIntoView({ block: 'center' })`)

/** Poll until MapLibre reports the sources loaded, or time out. */
const probe = async () => {
  const { result } = await call('Runtime.evaluate', {
    expression: `(() => {
      const m = window.__map
      const canvas = document.querySelector('.map-holder canvas')
      const err = document.querySelector('.map-error')
      if (err) return JSON.stringify({ state: 'error', message: err.textContent })
      if (!m) {
        // Production builds do not expose the map handle, so fall back to
        // proving the GL canvas actually painted non-background pixels.
        if (!canvas) return JSON.stringify({ state: 'no-map' })
        const gl = canvas.getContext('webgl2')
        const px = new Uint8Array(4 * canvas.width * canvas.height)
        let distinct = new Set()
        if (gl) {
          gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, px)
          for (let i = 0; i < px.length; i += 4000) {
            distinct.add(px[i] + ',' + px[i + 1] + ',' + px[i + 2])
          }
        }
        return JSON.stringify({
          state: 'canvas-only',
          canvas: { w: canvas.width, h: canvas.height },
          distinctColors: distinct.size,
          skeleton: !!document.querySelector('.map-skeleton'),
        })
      }
      const src = ['tz','country','city'].map((id) => {
        try { return { id, loaded: m.isSourceLoaded(id) } } catch { return { id, loaded: null } }
      })
      let tzFeatures = 0, countryFeatures = 0
      try { tzFeatures = m.queryRenderedFeatures({ layers: ['tz-fill'] }).length } catch {}
      try { countryFeatures = m.queryRenderedFeatures({ layers: ['country-fill'] }).length } catch {}
      // Country hover/selection needs a unique id per feature and a readable
      // ISO code in properties.id; assert both instead of trusting the fix.
      // A feature may be split across tiles, so the same id legitimately
       // repeats. What must never happen: a missing id, or one id covering two
       // different countries (the Ashmore/Australia "036" collision).
      let ids = { features: 0, missing: 0, collided: [], isoMissing: 0 }
      try {
        const byId = new Map()
        for (const f of m.querySourceFeatures('country')) {
          ids.features++
          if (f.id === undefined || f.id === null) { ids.missing++; continue }
          if (f.properties?.id === undefined) ids.isoMissing++
          const name = f.properties?.name ?? '?'
          if (!byId.has(f.id)) byId.set(f.id, new Set())
          byId.get(f.id).add(name)
        }
        ids.uniqueIds = byId.size
        for (const [id, names] of byId) {
          if (names.size > 1) ids.collided.push(id + ':' + [...names].join('/'))
        }
      } catch (e) { ids.error = String(e) }
      return JSON.stringify({
        state: 'ok',
        styleLoaded: m.isStyleLoaded(),
        canvas: canvas ? { w: canvas.width, h: canvas.height } : null,
        sources: src,
        tzFeatures,
        countryFeatures,
        countryIds: ids,
      })
    })()`,
    returnByValue: true,
  })
  return JSON.parse(result.value)
}

let snap
for (let i = 0; i < 30; i++) {
  await new Promise((r) => setTimeout(r, 1000))
  snap = await probe()
  if (consoleErrors.length) break
  if (snap.state === 'error') break
  if (snap.state === 'ok' && snap.tzFeatures > 0 && snap.countryFeatures > 0) break
  // Canvas-only path: we're in production and __map is not exposed.
  // We can't trust readPixels due to preserveDrawingBuffer: false.
  // Instead, wait for the skeleton to disappear, then capture a screenshot
  // and measure pixel diversity to confirm the map actually rendered.
  if (snap.state === 'canvas-only' && !snap.skeleton) {
    const clip = await evaluate(`(() => {
      const r = document.querySelector('.map-wrap').getBoundingClientRect()
      return { x: r.left + scrollX, y: r.top + scrollY, width: r.width, height: r.height, scale: 1 }
    })()`)
    const resp = await call('Page.captureScreenshot', { format: 'png', clip, captureBeyondViewport: true })
    if (resp?.data) {
      const png = Buffer.from(resp.data, 'base64')
      // A blank canvas would compress to ~1-2KB; a rendered map is >30KB.
      if (png.length > 20000) {
        snap.canvasProof = { pngSize: png.length }
        break
      }
    }
  }
}

if (consoleErrors.length) {
  throw new Error('Browser errors: ' + consoleErrors.join('\n'))
}

// ------------------------------------------------- detail panel interaction
// Clicking a country must anchor the panel next to the click (not park it in
// the bottom-right corner), and the panel must be draggable.
let panel = { state: 'skipped' }
if (snap?.state === 'ok' || snap?.canvasProof) {
  const mouse = async (type, x, y, extra = {}) =>
    call('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1, ...extra })

  // Click over land inside the map canvas.
  const target = await call('Runtime.evaluate', {
    expression: `(() => {
      const c = document.querySelector('.map-holder canvas')
      c.scrollIntoView({ block: 'center' })
      const r = c.getBoundingClientRect()
      return JSON.stringify({ x: Math.round(r.left + r.width * 0.46), y: Math.round(r.top + r.height * 0.55) })
    })()`,
    returnByValue: true,
  })
  const pt = JSON.parse(target.result.value)

  await mouse('mousePressed', pt.x, pt.y)
  await mouse('mouseReleased', pt.x, pt.y)
  await new Promise((r) => setTimeout(r, 900))

  const readPanel = async () => {
    const { result } = await call('Runtime.evaluate', {
      expression: `(() => {
        const el = document.querySelector('.detail')
        if (!el) return JSON.stringify({ open: false })
        const r = el.getBoundingClientRect()
        const h = document.querySelector('.map-section').getBoundingClientRect()
        return JSON.stringify({ open: true, x: Math.round(r.left), y: Math.round(r.top),
          pw: Math.round(r.width), ph: Math.round(r.height),
          vh: window.innerHeight, vw: window.innerWidth,
          host: { left: Math.round(h.left), top: Math.round(h.top),
                  right: Math.round(h.right), bottom: Math.round(h.bottom) },
          vis: getComputedStyle(el).visibility })
      })()`,
      returnByValue: true,
    })
    return JSON.parse(result.value)
  }

  const before = await readPanel()
  if (before.open) {
    const gapX = before.x - pt.x
    const anchored =
      Math.abs(gapX) < before.pw + 80 &&
      // Vertical centring can be limited by the viewport clamp, so allow for it.
      Math.abs(before.y + before.ph / 2 - pt.y) < before.ph / 2 + 40
    // Drag by the header, which is the declared drag handle.
    const hx = before.x + Math.round(before.pw / 2)
    const hy = before.y + 16
    // Drag above the map, into the city list's viewport area.
    await mouse('mousePressed', hx, hy)
    await pause(50)
    await mouse('mouseMoved', 20, 20, { buttons: 1 })
    await mouse('mouseReleased', 20, 20)
    await new Promise((r) => setTimeout(r, 250))
    const after = await readPanel()

    // The panel usually opens flush against the top edge, so an upward drag is
    // legitimately clamped to zero. Drag DOWN to prove vertical freedom exists.
    const slack = Math.round(after.vh - after.y - after.ph)
    const dy = Math.min(60, Math.max(0, slack - 20))
    let movedDownY = null
    if (dy > 0) {
      const dx0 = after.x + Math.round(after.pw / 2)
      const dy0 = after.y + 16
      await mouse('mousePressed', dx0, dy0)
      await pause(50)
      await mouse('mouseMoved', dx0, dy0 + dy, { buttons: 1 })
      await mouse('mouseReleased', dx0, dy0 + dy)
      await new Promise((r) => setTimeout(r, 250))
      const down = await readPanel()
      movedDownY = down.open ? down.y - after.y : null
    }
    const within = (p) =>
      p.open &&
      p.y >= 13 &&
      p.y + p.ph <= p.vh - 13 &&
      p.x >= 13 &&
      p.x + p.pw <= p.vw - 13
    panel = {
      state: 'checked',
      visibility: before.vis,
      anchoredNearClick: anchored,
      insideViewportOnOpen: within(before),
      insideViewportAfterDrag: within(after),
      movedOutsideMap: after.y < after.host.top - 1,
      host: before.host,
      click: pt,
      panelSize: { w: before.pw, h: before.ph },
      viewport: { w: before.vw, h: before.vh },
      maxY: Math.max(14, before.vh - before.ph - 14),
      before: { x: before.x, y: before.y },
      after: { x: after.x, y: after.y },
      movedX: after.open ? after.x - before.x : null,
      movedY: after.open ? after.y - before.y : null,
      movedDownY,
    }
  } else {
    panel = { state: 'no-panel', click: pt }
  }
}
console.log('detailPanel   :', JSON.stringify(panel, null, 2))
check('panel opens near map click and drags outside map',
  panel.state === 'checked' && panel.visibility === 'visible' && panel.anchoredNearClick &&
  panel.insideViewportOnOpen && panel.insideViewportAfterDrag && panel.movedOutsideMap && panel.movedDownY > 0,
  panel)

const inspectLayout = () => evaluate(`(() => {
  const grid = document.querySelector('.city-grid')
  const last = grid.lastElementChild.getBoundingClientRect()
  const map = document.querySelector('.map-wrap').getBoundingClientRect()
  const scroll = document.querySelector('.grid-scroll')
  const section = document.querySelector('.grid-section')
  return { count: grid.children.length, mapFollowsList: map.top >= last.bottom,
    complete: scroll.scrollHeight <= scroll.clientHeight + 1 && grid.scrollWidth <= grid.clientWidth + 1,
    uncapped: getComputedStyle(section).maxHeight === 'none',
    pageFits: document.documentElement.scrollWidth <= innerWidth,
    mapHeight: map.height }
})()`)
const panelVisible = () => evaluate(`(() => {
  const r = document.querySelector('.detail')?.getBoundingClientRect()
  return !!r && r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight + 1 && r.right <= innerWidth + 1
})()`)
const selectCity = async (name) => {
  await evaluate(`document.querySelector('.d-close')?.click();
    [...document.querySelectorAll('.city-card')].find(el => el.querySelector('.cc-name').textContent === ${JSON.stringify(name)})?.click()`)
  await pause()
}
const desktopLayout = await inspectLayout()
check('desktop list is fully expanded with map below', desktopLayout.complete && desktopLayout.uncapped && desktopLayout.mapFollowsList && desktopLayout.pageFits && desktopLayout.mapHeight >= 380, desktopLayout)
await evaluate('window.scrollTo(0, 0)')
await selectCity('北京')
check('card selection opens a visible panel without scrolling to map', await panelVisible())
const selected = await evaluate(`({ title: document.querySelector('.d-title')?.textContent,
  card: document.querySelector('.city-card.is-selected .cc-name')?.textContent })`)
check('same-zone city keeps its selected identity', selected.title?.startsWith('北京') && selected.card === '北京', selected)
await evaluate(`document.querySelector('.detail .d-actions .btn:not(.primary)')?.click()`)
const pins = await evaluate(`JSON.parse(localStorage.getItem('timesphere.v1') ?? '{}').pinned`)
check('pin action targets selected city', pins?.includes('shanghai') && !pins?.includes('beijing'), pins)

// Real form events, including the base-zone change that previously reset the instant.
await evaluate(`document.querySelector('.d-close')?.click(); document.querySelectorAll('.tm-btn')[1].click()`)
await pause()
const fillInput = async (selector, value) => {
  await evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)})
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, ${JSON.stringify(value)})
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  })()`)
  await pause()
}
await fillInput('#tz-custom-date', '2026-12-25')
await fillInput('#tz-custom-time', '10:00')
if (snap.state === 'ok') {
  await fillInput('#tz-custom-date', '2026-10-04')
  await fillInput('#tz-custom-time', '00:20')
  const offsetBefore = await evaluate(`window.__map.getSource('tz').getData().then(data => data.features.find(f => f.properties.tzid === 'Australia/Adelaide').properties.offset)`)
  await fillInput('#tz-custom-time', '00:40')
  const offsetAfter = await evaluate(`window.__map.getSource('tz').getData().then(data => data.features.find(f => f.properties.tzid === 'Australia/Adelaide').properties.offset)`)
  check('map updates offsets at a half-hour DST transition', offsetBefore === 570 && offsetAfter === 630, { offsetBefore, offsetAfter })
  await fillInput('#tz-custom-date', '2026-12-25')
  await fillInput('#tz-custom-time', '10:00')
}
await selectCity('东京')
await evaluate(`document.querySelector('.detail .btn.primary').click()`)
await pause()
const custom = await evaluate(`({ date: document.querySelector('#tz-custom-date').value,
  time: document.querySelector('#tz-custom-time').value, clock: document.querySelector('.clock-time').textContent })`)
check('changing base preserves planned instant', custom.date === '2026-12-25' && custom.time === '11:00' && custom.clock.startsWith('11:00'), custom)
await evaluate(`document.querySelectorAll('.tm-btn')[0].click()`)

for (const [width, height] of [[390, 844], [320, 568], [1024, 420]]) {
  await evaluate(`document.querySelector('.d-close')?.click()`)
  await call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
  await pause()
  const layout = await inspectLayout()
  check('complete list at ' + width + 'x' + height, layout.complete && layout.uncapped && layout.mapFollowsList && layout.pageFits && layout.mapHeight >= 380, layout)
  await selectCity('奥克兰')
  check('panel fits ' + width + 'x' + height, await panelVisible())
  if (process.argv[3]) {
    const shot = await call('Page.captureScreenshot', { format: 'png' })
    await writeFile(process.argv[3].replace(/\.png$/, '-' + width + '.png'), Buffer.from(shot.data, 'base64'))
  }
}
await call('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
await pause()

// Ensure malformed persisted preferences cannot stop the application booting.
await evaluate(`localStorage.setItem('timesphere.v1', JSON.stringify({ pinned: 'invalid', baseTimezone: 42, displayMode: 'unknown' }))`)
await call('Page.reload', { ignoreCache: true })
await pause(1800)
check('malformed local preferences recover without blank page', await evaluate(`document.querySelectorAll('.city-card').length > 0`))

const shotPath = process.argv[3]
if (shotPath) {
  const resp = await call('Page.captureScreenshot', { format: 'png' })
  if (resp?.data) {
    await writeFile(shotPath, Buffer.from(resp.data, 'base64'))
    console.log('screenshot    :', shotPath)
  }
}

console.log('URL           :', URL_UNDER_TEST)
console.log('snapshot      :', JSON.stringify(snap, null, 2))
console.log('consoleErrors :', consoleErrors.length ? consoleErrors.slice(0, 10) : 'none')
console.log('failedReqs    :', failedRequests.length ? failedRequests.slice(0, 10) : 'none')
console.log('checks        :', JSON.stringify(checks, null, 2))

const rendered =
  (snap?.state === 'ok' && snap.tzFeatures > 0 && snap.countryFeatures > 0) ||
  (snap?.state === 'canvas-only' && !snap.skeleton && !!snap.canvasProof)
console.log(rendered ? '\nRESULT: map rendered features OK' : '\nRESULT: MAP DID NOT RENDER')
const passed = rendered && checks.every(c => c.passed) && !consoleErrors.length && !failedRequests.length
console.log(passed ? 'RESULT: UI regression checks OK' : 'RESULT: UI REGRESSION CHECKS FAILED')

try {
  await send('Browser.close')
} catch {}
try {
  ws.close()
} catch {}
// The 'exit' handler runs cleanup(); it is idempotent, so a graceful close
// here plus the handler covers both normal and abnormal termination.
process.exit(passed ? 0 : 1)
