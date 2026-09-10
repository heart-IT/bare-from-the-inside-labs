// Bare From the Inside, Part 1 — lab driver.
//
// Runs the four probes in order. Probe 3 runs twice, from two different
// directories, because the difference between the two runs is the lesson.
import { spawnSync } from 'node:child_process'
import { mkdtempSync, copyFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const here = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)

// The npm `bare` command is a Node shim. Going through it rather than straight
// to the prebuilt binary matters: the prebuild ships non-executable, and the
// shim is what chmods it on first spawn (bare-runtime/lib/spawn.js:25-29).
//
// Resolved through the package entry point rather than node_modules/.bin, so
// this runs the version pinned in package.json even if npm made no bin link
// and even if you have a different `bare` on your PATH.
const shim = join(dirname(require.resolve('bare')), 'bin', 'bare')

// `npm start` runs everything; `npm run probe:namespace` runs one.
const only = process.argv[2] ? Number(process.argv[2]) : null
const wanted = (n) => only === null || Math.trunc(n) === only

function heading (n, title, note) {
  console.log('\n' + '─'.repeat(72))
  console.log(`  ${n}. ${title}`)
  if (note) console.log(`     ${note}`)
  console.log('─'.repeat(72))
}

function bare (script, cwd = here) {
  const r = spawnSync(process.execPath, [shim, script], { cwd, stdio: 'inherit' })
  if (r.status !== 0) process.exitCode = 1
}

if (wanted(1)) {
  heading(1, 'What is actually running?', 'the npm version and the binary version may differ')
  bare('probes/01-identity.js')
}

if (wanted(2)) {
  heading(2, 'What you get for free', 'and the four names with no Node counterpart')
  bare('probes/02-namespace.js')
}

if (wanted(3)) {
  heading(3, 'What require() can find — from this directory', 'node_modules is populated here')
  bare('probes/03-resolution.js')

  heading(3.5, 'The same probe, from an empty directory', 'same binary, same script, nothing on disk beside it')
  const scratch = mkdtempSync(join(tmpdir(), 'lab-01-'))
  try {
    copyFileSync(join(here, 'probes', '03-resolution.js'), join(scratch, '03-resolution.js'))
    bare('03-resolution.js', scratch)
    console.log('\n  The script was copied, not re-pointed. Moving the file moved the answer.')
  } finally {
    rmSync(scratch, { recursive: true, force: true })
  }
}

if (wanted(4)) {
  heading(4, 'What `npm i bare` actually installed', 'a Node shim, and a per-target prebuilt binary')
  spawnSync(process.execPath, [join(here, 'probes', '04-distribution.mjs')], { cwd: here, stdio: 'inherit' })
}

console.log('\n' + '─'.repeat(72))
console.log('  Post: https://heartit.tech/bare-from-the-inside-part-1-why-p2p-needed-its-own-runtime/')
console.log('─'.repeat(72) + '\n')
