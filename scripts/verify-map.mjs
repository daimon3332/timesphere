/**
 * Headless smoke check for the map render path, driven over raw CDP so it
 * needs no Playwright dependency. Verifies that the MapLibre worker parses the
 * GeoJSON sources (the failure that showed up only in production builds) and
 * reports console errors plus failed requests.
 *
 * Usage: node scripts/verify-map.mjs [url] [screenshot.png]
 */
import { spawn } from 'node:child_process'
import { existsSync, globSync, mkdtempSync, rmSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'

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
const profile = mkdtempSync(join(tmpdir(), 'tsphere-'))

// On Windows the launcher process exits immediately while the real browser
// keeps running, so the ws endpoint is discovered over HTTP rather than stderr.
spawn(
  CHROME,
  [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    '--no-first-run',
    '--no-default-browser-check',
    // Software GL: headless has no real GPU, but MapLibre requires WebGL2.
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--hide-scrollbars',
    '--window-size=1440,900',
    `--user-data-dir=${profile}`,
    'about:blank',
  ],
  { stdio: 'ignore', detached: true },
).unref()

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
    pending.set(id, { resolve, reject })
    ws.send(JSON.stringify({ id, method, params, sessionId }))
  })

// Attach to a real tab so page-scoped domains are available.
const { targetId } = await send('Target.createTarget', { url: 'about:blank' })
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true })
const call = (method, params) => send(method, params, sessionId)

await call('Page.enable')
await call('Runtime.enable')
await call('Network.enable')

const loaded = new Promise((resolve) => {
  const onLoad = (ev) => {
    const msg = JSON.parse(ev.data)
    if (msg.method === 'Page.loadEventFired') resolve()
  }
  ws.addEventListener('message', onLoad)
})
await call('Page.navigate', { url: URL_UNDER_TEST })
await loaded

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
  if (snap.state === 'error') break
  if (snap.state === 'ok' && snap.tzFeatures > 0 && snap.countryFeatures > 0) break
  // Canvas-only path: we're in production and __map is not exposed.
  // We can't trust readPixels due to preserveDrawingBuffer: false.
  // Instead, wait for the skeleton to disappear, then capture a screenshot
  // and measure pixel diversity to confirm the map actually rendered.
  if (snap.state === 'canvas-only' && !snap.skeleton) {
    const resp = await call('Page.captureScreenshot', { format: 'png' })
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
        return JSON.stringify({ open: true, x: Math.round(r.left), y: Math.round(r.top),
          pw: Math.round(r.width), ph: Math.round(r.height),
          vh: window.innerHeight, vw: window.innerWidth,
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
    // Drag left and UP: down may legitimately be clamped by the bottom edge.
    await mouse('mousePressed', hx, hy)
    await mouse('mouseMoved', hx - 180, hy - 60)
    await mouse('mouseMoved', hx - 200, hy - 90)
    await mouse('mouseReleased', hx - 200, hy - 90)
    await new Promise((r) => setTimeout(r, 250))
    const after = await readPanel()
    panel = {
      state: 'checked',
      visibility: before.vis,
      anchoredNearClick: anchored,
      click: pt,
      panelSize: { w: before.pw, h: before.ph },
      viewport: { w: before.vw, h: before.vh },
      maxY: Math.max(14, before.vh - before.ph - 14),
      before: { x: before.x, y: before.y },
      after: { x: after.x, y: after.y },
      movedX: after.open ? after.x - before.x : null,
      movedY: after.open ? after.y - before.y : null,
    }
  } else {
    panel = { state: 'no-panel', click: pt }
  }
}
console.log('detailPanel   :', JSON.stringify(panel, null, 2))

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

const rendered =
  (snap?.state === 'ok' && snap.tzFeatures > 0 && snap.countryFeatures > 0) ||
  (snap?.state === 'canvas-only' && !snap.skeleton && !!snap.canvasProof)
console.log(rendered ? '\nRESULT: map rendered features OK' : '\nRESULT: MAP DID NOT RENDER')

try {
  await send('Browser.close')
} catch {}
try {
  ws.close()
} catch {}
try {
  rmSync(profile, { recursive: true, force: true })
} catch {}
process.exit(rendered ? 0 : 1)
