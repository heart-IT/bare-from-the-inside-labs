// Bare From the Inside, Part 6 — lab driver.
//
// Six probes on native addons: compile one, watch require.addon() look for it,
// load a Node-API addon, register one from a constructor, seal addon loading,
// and take bare-sqlite apart. Output goes to out/, which each probe recreates,
// so the probes can run in any order.
import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const here = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)

// Resolved through the package entry point rather than node_modules/.bin, so
// this runs the version pinned in package.json even if npm made no bin link
// and even if you have a different `bare` on your PATH.
const shim = join(dirname(require.resolve('bare')), 'bin', 'bare')
const binary = require('bare-runtime')()
const bareHeaders = join(dirname(require.resolve('bare-headers/package')), 'include')
const napiHeaders = join(dirname(require.resolve('node-api-headers/package.json')), 'include')

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

function fresh (name) {
  const dir = join(out, name)
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  return dir
}

// Paths in the output are printed relative to the lab, so the README's
// transcript matches your machine.
const tidy = (text) => text.split(here).join('<lab>')

function exec (cmd, args, cwd = here, env = process.env) {
  return spawnSync(cmd, args, { cwd, encoding: 'utf8', env, maxBuffer: 64 * 1024 * 1024 })
}

function print (text) {
  for (const line of tidy(text).trimEnd().split('\n')) if (line) console.log('  ' + line)
}

// The probes' own output is printed whole; an uncaught error is cut to its
// first line, because the stack under it is the loader's own frames, whose
// line numbers move between releases.
function bare (args, cwd = here) {
  const r = exec(process.execPath, [shim, ...args], cwd)
  print(r.stdout)
  if (r.stderr) print(r.stderr.split('\n')[0])
  return r.status
}

function exported (file) {
  return exec('nm', ['-gU', file]).stdout.trim().split('\n').filter(Boolean).map((line) => line.split(' ').pop())
}

// The compiler flags below are Apple clang's; on other systems the compiling
// probes say so and stop rather than guess at a toolchain nobody ran.
function needsMac () {
  if (darwin) return false
  console.log(`  skipped: this probe's compiler and nm flags are macOS's, and this is ${host}`)
  return true
}

// add.c is built against Bare's headers, add-napi.c against Node's.
function compile (source, output, flags = []) {
  const headers = source === 'add-napi.c' ? napiHeaders : bareHeaders
  return exec('cc', ['-shared', ...flags, '-I', headers, '-o', output, join(here, 'addon', source)])
}

function addPackage (dir, where) {
  const pkg = join(dir, 'node_modules', 'add')
  mkdirSync(join(pkg, where), { recursive: true })
  writeFileSync(join(pkg, 'package.json'), JSON.stringify({ name: 'add', version: '1.0.0', main: 'index.js', addon: true }, null, 2) + '\n')
  writeFileSync(join(pkg, 'index.js'), 'module.exports = require.addon()\n')
  const r = compile('add.c', join(pkg, where, 'add.bare'), ['-undefined', 'dynamic_lookup'])
  if (r.status !== 0) throw new Error(r.stderr)
  return pkg
}

if (wanted(1)) {
  heading(1, 'Compile an addon the obvious way', 'cc -shared, then the flag cmake-bare adds')
  if (!needsMac()) {
    const dir = fresh('compile')
    console.log('  $ cc -shared -I node_modules/bare-headers/include -o add.bare add.c')
    const plain = compile('add.c', join(dir, 'add.bare'))
    const missing = plain.stderr.split('\n').filter((line) => /^ {2}"_/.test(line)).map((line) => line.trim().split('"')[1])
    console.log(`  ${plain.stderr.split('\n')[0]}`)
    for (const name of missing) console.log(`    ${name}`)
    console.log(`  exit status ${plain.status}`)

    const symbols = exported(binary)
    const count = (re) => symbols.filter((name) => re.test(name)).length
    console.log(`\n  the bare binary exports ${count(/^_js_/)} js_* functions, ${count(/^_(napi|node_api)_/)} Node-API ones and ${count(/^_uv_/)} of libuv's`)

    console.log('\n  $ cc -shared -undefined dynamic_lookup -I node_modules/bare-headers/include -o add.bare add.c')
    const linked = compile('add.c', join(dir, 'add.bare'), ['-undefined', 'dynamic_lookup'])
    console.log(`  exit status ${linked.status}; add.bare exports ${exported(join(dir, 'add.bare')).join(' ')}`)
    bare(['-e', "console.log(\"require('./add.bare').add(2, 3) →\", require('./add.bare').add(2, 3))"], dir)
  }
}

if (wanted(2)) {
  heading(2, 'Where require.addon() looks', "a package whose index.js is `module.exports = require.addon()`")
  if (!needsMac()) {
    const dir = fresh('find')
    copyFileSync(join(here, 'probes/use.js'), join(dir, 'use.js'))
    copyFileSync(join(here, 'probes/computed.js'), join(dir, 'computed.js'))

    addPackage(dir, '.')
    console.log('  add.bare beside index.js:')
    bare(['use.js'], dir)
    console.log('\n  the same package, asked with the name in a variable:')
    bare(['computed.js'], dir)

    rmSync(join(dir, 'node_modules'), { recursive: true, force: true })
    addPackage(dir, join('prebuilds', host))
    console.log(`\n  add.bare in prebuilds/${host}/:`)
    bare(['use.js'], dir)
  }
}

if (wanted(3)) {
  heading(3, 'An addon built for Node', 'compiled against the Node-API headers, loaded by Node and by Bare')
  if (!needsMac()) {
    const dir = fresh('napi')
    const r = compile('add-napi.c', join(dir, 'add.node'), ['-undefined', 'dynamic_lookup'])
    if (r.status !== 0) throw new Error(r.stderr)
    console.log(`  add.node exports ${exported(join(dir, 'add.node')).join(' ')}`)
    const code = "console.log(\"require('./add.node').add(2, 3) →\", require('./add.node').add(2, 3))"
    const node = exec(process.execPath, ['-e', code], dir)
    console.log('  node: ' + node.stdout.trim())
    const onBare = exec(process.execPath, [shim, '-e', code], dir)
    console.log('  bare: ' + onBare.stdout.trim())
  }
}

if (wanted(4)) {
  heading(4, 'The other way in: a constructor', 'the same add.c, built with BARE_MODULE_REGISTER_CONSTRUCTOR')
  if (!needsMac()) {
    const dir = fresh('constructor')
    const r = compile('add.c', join(dir, 'add.bare'), ['-undefined', 'dynamic_lookup', '-DBARE_MODULE_REGISTER_CONSTRUCTOR'])
    if (r.status !== 0) throw new Error(r.stderr)
    const names = exported(join(dir, 'add.bare'))
    console.log(`  add.bare exports ${names.length ? names.join(' ') : 'nothing'}`)
    const undefinedBare = exec('nm', ['-u', join(dir, 'add.bare')]).stdout.split('\n').filter((name) => name.startsWith('_bare_'))
    console.log(`  and asks the host for ${undefinedBare.join(' ')}`)
    bare(['-e', "console.log(\"require('./add.bare').add(2, 3) →\", require('./add.bare').add(2, 3))"], dir)

    const constructor = exec('nm', [binary]).stdout.split('\n').find((line) => line.endsWith(' _bare_register_module_bare_url'))
    console.log('\n  one of the constructors in the bare binary itself (nm, t = local code):')
    console.log('    ' + constructor.split(' ').slice(1).join(' '))
  }
}

if (wanted(5)) {
  heading(5, 'Seal addon loading', 'bare-sqlite loads first; then Bare.Addon.seal(); then add')
  if (!needsMac()) {
    const dir = fresh('seal')
    copyFileSync(join(here, 'probes/seal.js'), join(dir, 'seal.js'))
    addPackage(dir, join('prebuilds', host))
    const status = bare(['seal.js'], dir)
    console.log(`  exit status ${status}`)
  }
}

if (wanted(6)) {
  heading(6, 'Showcase: bare-sqlite + bare-sqlite-vector', 'a query, the prebuild behind it, and the same file under Node')
  bare(['probes/sqlite.js'])

  const prebuilds = join(here, 'node_modules/bare-sqlite/prebuilds')
  console.log(`  prebuilds shipped for ${readdirSync(prebuilds).length} hosts`)

  if (darwin) {
    const r = exec(process.execPath, [shim, 'probes/sqlite.js'], here, { ...process.env, DYLD_PRINT_LIBRARIES: '1' })
    const opened = r.stderr.split('\n').filter((line) => line.endsWith('.bare')).map((line) => line.split('> ').pop())
    console.log('\n  DYLD_PRINT_LIBRARIES, in the order the loader opened them:')
    for (const file of opened) console.log('    ' + tidy(file))

    const prebuild = join(prebuilds, host, 'bare-sqlite.bare')
    const names = exported(prebuild).map((name) => name.slice(1))
    const sqlite = names.filter((name) => name.startsWith('sqlite3'))
    console.log(`\n  bare-sqlite.bare exports ${sqlite.length} sqlite3* symbols and ${names.filter((name) => !name.startsWith('sqlite3')).join(', ')}`)
    console.log(`  its install name (otool -D): ${exec('otool', ['-D', prebuild]).stdout.trim().split('\n').pop()}`)
    const strings = exec('strings', [prebuild]).stdout.split('\n').filter((line) => line.startsWith('bare-sqlite@'))
    console.log(`  the name it registers (strings): ${strings.join(', ')}`)

    const vector = join(here, 'node_modules/bare-sqlite-vector/prebuilds', host, 'bare-sqlite-vector.bare')
    const self = exec('otool', ['-D', vector]).stdout.trim().split('\n').pop()
    const needs = exec('otool', ['-L', vector]).stdout.trim().split('\n').slice(1).map((line) => line.trim().split(' (')[0]).filter((name) => name !== self)
    console.log(`  bare-sqlite-vector.bare needs (otool -L): ${needs.join(', ')}`)
  }

  console.log('\n  the same file under Node:')
  const node = exec(process.execPath, ['probes/sqlite.js'])
  console.log('  ' + node.stderr.split('\n').find((line) => /Error/.test(line)))
  if (darwin) {
    const dl = exec(process.execPath, ['-e', `try { process.dlopen({ exports: {} }, ${JSON.stringify(join(prebuilds, host, 'bare-sqlite.bare'))}) } catch (err) { console.log(err.message) }`])
    console.log('  process.dlopen on the prebuild: ' + tidy(dl.stdout.trim()))
  }
}

console.log('\n' + '─'.repeat(72))
console.log('  Post: Bare From the Inside, Part 6 — The Native Seam')
console.log('─'.repeat(72) + '\n')
