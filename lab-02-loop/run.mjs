// Bare From the Inside, Part 2 — lab driver.
//
// Runs the four probes in order. Probe 2 runs twice, under Bare and under
// Node, because the difference between the two runs is the lesson.
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

function bare (script) {
  spawnSync(process.execPath, [shim, join(here, script)], { cwd: here, stdio: 'inherit' })
}

function node (script) {
  spawnSync(process.execPath, [join(here, script)], { cwd: here, stdio: 'inherit' })
}

if (wanted(1)) {
  heading(1, 'The coarse order', 'sync, then microtasks, then libuv phases')
  bare('probes/01-ordering.js')
}

if (wanted(2)) {
  heading(2, 'Where the checkpoint falls', 'one file, two runtimes, two answers')
  console.log('under Bare:')
  bare('probes/02-checkpoint.js')
  console.log('\nunder Node:')
  node('probes/02-checkpoint.js')
  console.log('\n  Both timeouts are due together. Bare drains the whole expired')
  console.log('  batch in one entry into JavaScript, so the promise scheduled by')
  console.log('  the first waits for the second. Node re-enters per callback.')
}

if (wanted(3)) {
  heading(3, 'beforeExit is a question, not an event', 'asked again every time the loop drains')
  bare('probes/03-drain.js')
  console.log('\n  Three times, because the first two listeners each gave libuv')
  console.log('  something to wait for. `exit` sits outside the do/while: once.')
}

if (wanted(4)) {
  heading(4, 'Every way this ends', 'and what each one costs')
  spawnSync(process.execPath, [join(here, 'probes', '04-exit-paths.mjs')], {
    cwd: here,
    stdio: 'inherit'
  })
}

console.log('\n' + '─'.repeat(72))
console.log('  Post: https://heartit.tech/bare-from-the-inside-part-2-what-actually-runs/')
console.log('─'.repeat(72) + '\n')
