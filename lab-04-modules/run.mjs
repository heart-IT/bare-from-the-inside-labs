// Bare From the Inside, Part 4 — lab driver.
//
// Five probes on how a specifier becomes a URL. Probe 5 runs the same file
// under Bare and under Node, because the difference is the lesson.
//
// The fixtures are five hand-written packages under fixtures/. They are copied
// into node_modules/ before the probes run: npm will not install them, and
// node_modules is gitignored, so the copy is what makes them exist. Each is two
// or three lines — a package.json shaped to make one resolution decision
// visible, and just enough JavaScript to prove which branch was taken.
import { spawnSync } from 'node:child_process'
import { cpSync, mkdirSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const here = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)

// Resolved through the package entry point rather than node_modules/.bin, so
// this runs the version pinned in package.json even if npm made no bin link
// and even if you have a different `bare` on your PATH.
const shim = join(dirname(require.resolve('bare')), 'bin', 'bare')

const modules = join(here, 'node_modules')
mkdirSync(modules, { recursive: true })
for (const name of readdirSync(join(here, 'fixtures'))) {
  cpSync(join(here, 'fixtures', name), join(modules, name), { recursive: true })
}

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
  heading(1, 'What is in the binary, and what you can require', 'two unrelated questions')
  bare('probes/01-builtins.js')
  console.log('\n  All five are compiled in. The two that resolved came off disk,')
  console.log('  as transitive dependencies of bare-runtime. bare-module is the')
  console.log('  package running the require that cannot find it.')
}

if (wanted(2)) {
  heading(2, 'Resolution proposes candidates', 'in a fixed order, and asks about each one')
  bare('probes/02-candidates.js')
  console.log('\n  Nothing here knows where a file is. It guesses in a documented')
  console.log('  order and asks the protocol whether each guess exists.')
}

if (wanted(3)) {
  heading(3, 'Conditions are a set; the package orders them', 'same runtime, opposite answers')
  bare('probes/03-conditions.js')
  console.log('\n  Both `bare` and `node` are always in the set. Which one wins is')
  console.log("  decided by the order of the keys in the package's own exports.")
}

if (wanted(4)) {
  heading(4, 'The answer is a URL, filed under who asked', 'referrer, specifier, condition')
  bare('probes/04-resolutions.js')
  console.log('\n  That table is the contract. Walking node_modules is only how you')
  console.log('  fill it in when nobody already has — which is Part 5.')
}

if (wanted(5)) {
  heading(5, 'One file, two runtimes', 'the trick Shoebox runs across 164 packages')
  console.log('under Bare:')
  bare('probes/05-dual.js')
  console.log('\nunder Node:')
  node('probes/05-dual.js')
  console.log('\n  store.js asks for "fs" both times. This lab\'s package.json maps')
  console.log('  that specifier under the `bare` condition and leaves `default`')
  console.log('  alone, so each runtime answers it with its own filesystem.')
}

console.log('\n' + '─'.repeat(72))
console.log('  Post: https://heartit.tech/bare-from-the-inside-part-4-every-module-is-a-url/')
console.log('─'.repeat(72) + '\n')
