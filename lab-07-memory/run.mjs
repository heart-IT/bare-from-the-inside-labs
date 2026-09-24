// Bare From the Inside, Part 7 — lab driver.
//
// Six probes on who owns memory that crosses between C and JavaScript: a
// handle kept too long and a reference that keeps its value, bytes C lends and
// borrows, bytes freed too early under AddressSanitizer, a pointer wrapped in
// an object, what runs when the environment is destroyed, and bare-ffmpeg's
// handles. The addon is built into out/ by the first probe of each run that
// needs it, so the probes can run in any order.
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { constants } from 'node:os'

const here = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)

// Resolved through the package entry point rather than node_modules/.bin, so
// this runs the version pinned in package.json even if npm made no bin link
// and even if you have a different `bare` on your PATH.
const shim = join(dirname(require.resolve('bare')), 'bin', 'bare')
const binary = require('bare-runtime')()
const headers = join(dirname(require.resolve('bare-headers/package')), 'include')

const host = `${process.platform}-${process.arch}`
const out = join(here, 'out')
const darwin = process.platform === 'darwin'

const only = process.argv[2] ? Number(process.argv[2]) : null
const wanted = (n) => only === null || n === only

function heading (n, title, note) {
  console.log('\n' + '─'.repeat(72))
  console.log(`  ${n}. ${title}`)
  if (note) console.log(`     ${note}`)
  console.log('─'.repeat(72))
}

function exec (cmd, args, env = process.env, cwd = here) {
  return spawnSync(cmd, args, { cwd, encoding: 'utf8', env, maxBuffer: 64 * 1024 * 1024 })
}

function print (text) {
  for (const line of text.trimEnd().split('\n')) if (line) console.log('  ' + line)
}

// A process killed by a signal has no exit status; say which signal it was.
// The shim reports its child's death by signal as 128 + the signal's number
// (bare-runtime/lib/spawn.js), so decode that too.
const signalName = (n) => Object.keys(constants.signals).find((name) => constants.signals[name] === n)

function ending (r) {
  if (r.signal) return `killed by ${r.signal}`
  if (r.status > 128) return `exit status ${r.status}: the binary was killed by ${signalName(r.status - 128)}`
  return `exit status ${r.status}`
}

// The probes run under the pinned shim with --expose-gc, which gives them
// gc() (bare/bin/bare.c turns it into the engine option).
function bare (script, env) {
  const r = exec(process.execPath, [shim, '--expose-gc', script], env)
  print(r.stdout)
  return r
}

// The compiler flags below are Apple clang's; on other systems the compiling
// probes say so and stop rather than guess at a toolchain nobody ran.
function needsMac () {
  if (darwin) return false
  console.log(`  skipped: this probe's compiler and sanitizer flags are macOS's, and this is ${host}`)
  return true
}

function build (output, flags = []) {
  mkdirSync(dirname(output), { recursive: true })
  const r = exec('cc', ['-shared', '-undefined', 'dynamic_lookup', ...flags, '-I', headers, '-o', output, 'own.c'], process.env, join(here, 'addon'))
  if (r.status !== 0) throw new Error(r.stderr)
}

let built = false

function addon () {
  if (built) return
  rmSync(out, { recursive: true, force: true })
  build(join(out, 'own.bare'))
  built = true
}

if (wanted(1)) {
  heading(1, 'A handle kept past its call', 'a static js_value_t *, then a js_ref_t with count 1 and with count 0')
  if (!needsMac()) {
    addon()
    bare('probes/handles.js')
  }
}

if (wanted(2)) {
  heading(2, 'Bytes C lends, bytes C borrows', 'an external ArrayBuffer with a finalizer, then one detached after the call')
  if (!needsMac()) {
    addon()
    bare('probes/lend.js')
  }
}

if (wanted(3)) {
  heading(3, 'Bytes freed while JavaScript still holds them', 'the same probe, built plainly and then with AddressSanitizer')
  if (!needsMac()) {
    addon()
    const target = join(out, 'early-free', 'own.bare')

    build(target)
    console.log('  built plainly:')
    const plain = bare('probes/early-free.js')
    console.log(`  ${ending(plain)}`)

    // The sanitizer's runtime has to be in the process before the addon is,
    // so it is inserted into the bare binary itself, run directly here rather
    // than through the shim, which is a Node program.
    build(target, ['-fsanitize=address', '-g'])
    const runtime = join(exec('cc', ['-print-resource-dir']).stdout.trim(), 'lib', 'darwin', 'libclang_rt.asan_osx_dynamic.dylib')
    console.log('\n  built with -fsanitize=address:')
    const r = exec(binary, ['probes/early-free.js'], { ...process.env, DYLD_INSERT_LIBRARIES: runtime })
    print(r.stdout)

    // The report's addresses, thread ids and engine frames change from run
    // to run; the kind of error and the two frames in own.c do not.
    const report = r.stderr.split('\n')
    const kind = report.find((line) => line.includes('ERROR: AddressSanitizer'))
    const access = report.find((line) => /^(READ|WRITE) of size/.test(line))
    const frame = (from) => report.slice(from).find((line) => line.includes(' own.c:'))
    const freedAt = report.findIndex((line) => line.startsWith('freed by thread'))
    console.log('  ' + kind.replace(/^==\d+==/, '').replace(/ on address.*/, ''))
    console.log('  ' + access.replace(/ at 0x[0-9a-f]+/, ''))
    console.log('    ' + frame(0).trim().replace(/^#\d+ 0x[0-9a-f]+ /, ''))
    console.log('  ' + report[freedAt].replace(/:$/, ''))
    console.log('    ' + frame(freedAt).trim().replace(/^#\d+ 0x[0-9a-f]+ /, ''))
    console.log(`  ${ending(r)}`)
  }
}

if (wanted(4)) {
  heading(4, 'A pointer wrapped in an object', 'js_wrap, js_unwrap, and the finalizer after the object is collected')
  if (!needsMac()) {
    addon()
    bare('probes/wrap.js')
  }
}

if (wanted(5)) {
  heading(5, 'What runs when the environment is destroyed', 'a wrapped object and lent bytes still alive when the script ends')
  if (!needsMac()) {
    addon()
    const r = bare('probes/exit.js')
    console.log('  after the last line, on stderr:')
    print(r.stderr)
    console.log(`  ${ending(r)}`)
  }
}

if (wanted(6)) {
  heading(6, 'Showcase: bare-ffmpeg', 'one 64×64 frame encoded to JPEG, and a frame used after destroy()')
  const installed = existsSync(join(here, 'ffmpeg', 'node_modules', 'bare-ffmpeg'))
  if (!installed) {
    console.log('  skipped: bare-ffmpeg is not installed. It ships FFmpeg for 13 hosts')
    console.log('  (about 420 MB). Run `npm run probe:ffmpeg` to install it and run this.')
  } else {
    bare('ffmpeg/encode.js')
    console.log('')
    const r = bare('ffmpeg/after-destroy.js')
    console.log(`  ${ending(r)}`)
  }
}

console.log('\n' + '─'.repeat(72))
console.log('  Post: Bare From the Inside, Part 7 — Who Owns This Memory?')
console.log('─'.repeat(72) + '\n')
