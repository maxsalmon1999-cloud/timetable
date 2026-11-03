// Ticks to-dos in real Safari (WebKit, the engine inside the iPhone/iPad/Mac app) and reports whether the tick
// rewards ran: stars and the light sweep drawn into the row, animations started, no errors.
// Runs in the "WebKit check" workflow: safaridriver on :4444, the dev server on :1420. Plain WebDriver over fetch.
const WD = 'http://localhost:4444'
const call = async (method, path, body) => {
  const r = await fetch(WD + path, { method, headers: { 'content-type': 'application/json' }, body: body && JSON.stringify(body) })
  const j = await r.json()
  if (!r.ok) throw new Error(`${method} ${path}: ${JSON.stringify(j)}`)
  return j.value
}
const { sessionId } = await call('POST', '/session', { capabilities: { alwaysMatch: { browserName: 'safari' } } })
const s = (path) => `/session/${sessionId}${path}`
const run = (script, args = []) => call('POST', s('/execute/sync'), { script, args })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const today = new Date()
const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7))
const lists = Array.from({ length: 7 }, () => [])
lists[(today.getDay() + 6) % 7] = ['Email tutor', 'Buy card', 'Read chapter 3'].map((text, i) => ({ id: 't' + i, text, done: false }))
const seed = { version: 4, activities: [], blocks: [], templates: [], todos: { [iso(monday)]: lists }, friendsChecked: iso(today) }

let failed = 0
const report = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`)
  if (!ok) failed++
}

for (const layout of ['phone', 'mac']) {
  await call('POST', s('/window/rect'), layout === 'phone' ? { width: 430, height: 932 } : { width: 1440, height: 900 })
  await call('POST', s('/url'), { url: 'http://localhost:1420/' + (layout === 'phone' ? '?phone=1' : '') })
  await run('localStorage.setItem("timetable-data-v1", arguments[0]); localStorage.removeItem("timetable-todo-sound")', [JSON.stringify(seed)])
  await call('POST', s('/refresh'), {})
  await sleep(1500)
  await run(`window.__errs = []; addEventListener('error', e => __errs.push(String(e.message))); addEventListener('unhandledrejection', e => __errs.push('rejection: ' + e.reason))`)
  if (layout === 'phone') await run(`document.querySelectorAll('.phone-tabs button')[1].click()`)
  else {
    await run(`[...document.querySelectorAll('.modal .btn')].find(b => b.textContent.includes('Not now'))?.click()`) // the calendar prompt
    await run(`document.querySelector('button[title="To-do list"]').click()`)
  }
  await sleep(700)
  const reduced = await run(`return matchMedia('(prefers-reduced-motion: reduce)').matches`)
  // GitHub's Macs have Reduce Motion on; iPhones often do too. Either way the stars must be drawn (gently if so).
  console.log(`${layout}: Reduce Motion is ${reduced ? 'on' : 'off'} in this Safari`)
  // a real click through WebDriver (pointer events + click), on the first box
  const el = await call('POST', s('/element'), { using: 'css selector', value: '.todo-item.own .todo-tick' })
  await call('POST', s(`/element/${Object.values(el)[0]}/click`), {})
  await sleep(300) // stars are mid-flight (120–200ms delay, then 480–700ms)
  const r = await run(`
    const row = document.querySelector('.todo-item.own')
    return {
      ticked: !!row?.querySelector('.todo-box.on'),
      stars: row ? row.querySelectorAll('svg path[d^="M12 1"]').length : -1,
      sweeps: row ? [...row.children].filter(c => c.style && c.style.overflow === 'hidden').length : -1,
      glows: row ? [...row.children].filter(c => c.style && c.style.background.includes('255, 230, 128')).length : -1,
      animations: document.getAnimations ? document.getAnimations().length : -1,
      audio: typeof AudioContext,
      errors: window.__errs,
    }`)
  console.log(layout, JSON.stringify(r))
  report(`${layout}: tick registered`, r.ticked)
  report(`${layout}: stars drawn in the row`, r.stars >= 2, `${r.stars} stars`)
  // Reduce Motion swaps the moving light sweep for a glow in place
  report(`${layout}: ${reduced ? 'glow' : 'light sweep'} drawn`, reduced ? r.glows >= 1 : r.sweeps >= 1)
  report(`${layout}: animations running`, r.animations > 0, `${r.animations}`)
  report(`${layout}: no script errors`, !r.errors.length, r.errors.join(' | '))
}
await call('DELETE', s(''))
console.log(failed ? `${failed} FAILED` : 'ALL PASSED')
process.exit(failed ? 1 : 0)
