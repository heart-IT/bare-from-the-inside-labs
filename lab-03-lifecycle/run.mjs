// Bare From the Inside, Part 3 — lab driver.
//
// Runs the five probes in order. Every probe ends itself. Probe 2 has to do it
// with Bare.exit, because it is the one demonstrating a loop that never drains
// — and killing it from here would not work anyway: the `bare` on your PATH is
// a Node shim that spawns the real binary as a grandchild and, with
// suppressSignals set, forwards nothing to it.
import { spawnSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const here = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)

// Resolved through the package entry point rather than node_modules/.bin, so
// this runs the version pinned in package.json even if npm made no bin link
// and even if you have a different `bare` on your PATH.
const shim = join(dirname(require.resolve('bare')), 'bin', 'bare')

const only = process.argv[2] ? Number(process.argv[2]) : null
const wanted = (n) => only === null || n === only

function heading (n, title, note) {
  console.log('\n' + '─'.repeat(72))
  console.log(`  ${n}. ${title}`)
  if (note) console.log(`     ${note}`)
  console.log('─'.repeat(72))
}

function bare (script, opts = {}) {
  return spawnSync(process.execPath, [shim, join(here, script)], {
    cwd: here,
    stdio: 'inherit',
    ...opts
  })
}

if (wanted(1)) {
  heading(1, 'Suspend is a request, not a statement', 'the next line runs, and so does a pending timer')
  bare('probes/01-request.js')
  console.log('\n  The statement after Bare.suspend() ran, and it ran before the')
  console.log("  'suspend' event: the request is two flags and a uv_async_send, read")
  console.log('  on the loop\'s next turn. The 300 ms timer fired 200 ms inside a')
  console.log('  500 ms linger, because nothing starts a timer with linger.')
}

if (wanted(2)) {
  heading(2, 'Nothing is suspended until the loop is empty', 'ticking for 2 s in the suspending state, then leaving via Bare.exit')
  bare('probes/02-never-drains.js')
  console.log('\n  on_suspend closes no handle and stops no timer. A ref\'d interval')
  console.log('  means uv_run never returns, so the branch that would emit \'idle\'')
  console.log('  is never reached. Suspension is a protocol, not an enforcement.')
}

if (wanted(3)) {
  heading(3, 'Idle is one uv_ref, and another thread lifts it', 'two children: one arms a timer on the way down, one does not')
  bare('probes/03-parked.js')
  console.log('\n  A parked with a timer pending and it stayed pending — bare-timers')
  console.log("  stops its uv handles on 'idle'. B armed one new timer from its idle")
  console.log('  listener, which re-armed the handle that was just stopped, and that')
  console.log('  handle serves the whole heap: B\'s pending timer fired too. A stop')
  console.log('  is not a lock. Both were freed by the main thread, not by anything')
  console.log('  they could run themselves.')
}

if (wanted(4)) {
  heading(4, 'A wakeup deadline is a ceiling, not an allowance', 'and it closes the window without cancelling the work')
  bare('probes/04-deadline.js')
  console.log('\n  A asked for 100 ms and started 300 ms of work: the deadline stopped')
  console.log('  the loop on time and the work finished afterwards, outside the')
  console.log('  window. B finished early, so the deadline was never reached.')
}

if (wanted(5)) {
  heading(5, 'Suspension cascades; sockets do not', 'one Bare.suspend(), two runtimes')
  bare('probes/05-cascade.js')
  console.log('\n  Nobody addressed the child. on_suspend walks the thread list and')
  console.log('  hands each child the same request and the same linger. What it does')
  console.log('  not do is close anything — the child reached \'idle\' only because it')
  console.log('  listened and cleared its own interval.')
}

console.log('\n' + '─'.repeat(72))
console.log('  Post: https://heartit.tech/bare-from-the-inside-part-3-suspend-is-not-pause/')
console.log('─'.repeat(72) + '\n')
