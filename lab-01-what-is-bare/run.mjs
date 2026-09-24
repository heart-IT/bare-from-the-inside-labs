// Bare From the Inside, Part 1 — lab driver.
//
// Runs the five probes in order. Probe 3 runs twice, from two different
// directories, because the difference between the two runs is the lesson.
import { spawnSync } from 'node:child_process'
import { mkdtempSync, copyFileSync, mkdirSync, readdirSync, rmSync, symlinkSync } from 'node:fs'
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
  // The post runs this probe three times: after `npm i bare`, after
  // `npm i bare-crypto`, and from an empty folder. The first state is a
  // folder whose node_modules has everything this lab installed except
  // bare-crypto; linking the rest keeps it offline and the same versions.
  heading('3a', 'What require() can find — before `npm i bare-crypto`', 'Bare installed, bare-crypto not')
  const before = mkdtempSync(join(tmpdir(), 'lab-01-'))
  try {
    mkdirSync(join(before, 'node_modules'))
    for (const name of readdirSync(join(here, 'node_modules'))) {
      if (name === 'bare-crypto' || name.startsWith('.')) continue
      symlinkSync(join(here, 'node_modules', name), join(before, 'node_modules', name), 'junction')
    }
    copyFileSync(join(here, 'probes', '03-resolution.js'), join(before, '03-resolution.js'))
    bare('03-resolution.js', before)
  } finally {
    rmSync(before, { recursive: true, force: true })
  }

  heading('3b', 'What require() can find — after `npm i bare-crypto`', 'this lab directory, where package.json pins it')
  bare('probes/03-resolution.js')

  heading('3c', 'The same probe, from an empty directory', 'same binary, same script, nothing on disk beside it')
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

if (wanted(5)) {
  heading(5, 'The tool you expected built in', 'fetch, from two npm packages: bare-fetch and bare-http1')
  bare('probes/05-fetch.js')
}

console.log('\n' + '─'.repeat(72))
console.log('  Post: https://heartit.tech/bare-from-the-inside-part-1-why-p2p-needed-its-own-runtime/')
console.log('─'.repeat(72) + '\n')
