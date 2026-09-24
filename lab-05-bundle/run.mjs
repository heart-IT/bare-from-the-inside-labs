// Bare From the Inside, Part 5 — lab driver.
//
// Eight probes on turning a node_modules tree into one file per host. Most of
// them pack the same app.js; what changes is the host it is packed for and
// where its native code ends up. Output goes to out/, which each probe
// recreates, so the probes can run in any order.
import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const here = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)

// Resolved through the package entry point rather than node_modules/.bin, so
// this runs the version pinned in package.json even if npm made no bin link
// and even if you have a different `bare` on your PATH.
const shim = join(dirname(require.resolve('bare')), 'bin', 'bare')
const pack = join(dirname(require.resolve('bare-pack')), 'bin.js')
const link = join(dirname(require.resolve('bare-link')), 'bin.js')

const host = `${process.platform}-${process.arch}`
const out = join(here, 'out')

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
//
// "Somewhere else" is a fresh folder under the system temp directory: nothing
// above it has a node_modules, so a bundle run there cannot quietly fall back
// to the lab's packages.
function elsewhere () {
  return realpathSync(mkdtempSync(join(tmpdir(), 'lab-05-')))
}

function run (cmd, args, cwd = here) {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8' })
  const text = (r.stdout + r.stderr).split(here).join('<lab>').split(tmpdir()).join('$TMPDIR')
  for (const line of text.trimEnd().split('\n')) if (line) console.log('  ' + line)
  return r.status
}

const bare = (file, cwd) => run(process.execPath, [shim, file], cwd)
const node = (...args) => run(process.execPath, args)

// The first lines of an uncaught error name the failure; the stack below it
// is the loader's own frames, and their line numbers move between releases.
function bareHead (file, cwd, lines) {
  const r = spawnSync(process.execPath, [shim, file], { cwd, encoding: 'utf8' })
  const text = (r.stdout + r.stderr).split(here).join('<lab>').split(cwd).join('<elsewhere>')
  for (const line of text.split('\n').slice(0, lines)) console.log('  ' + line)
  console.log(`  exit status ${r.status}`)
}

if (wanted(1)) {
  heading(1, 'A bundle by hand', 'a length, a JSON header, then the files')
  const dir = fresh('hand')
  node(join(here, 'probes/hand.mjs'), join(dir, 'hand.bundle'))
  const bytes = spawnSync('head', ['-c', '48', join(dir, 'hand.bundle')], { encoding: 'utf8' }).stdout
  console.log('  first bytes: ' + JSON.stringify(bytes))
  bare('hand.bundle', dir)
  cpSync(join(dir, 'hand.bundle'), join(dir, 'hand.js'))
  console.log('\n  the same bytes, saved as hand.js:')
  bareHead('hand.js', dir, 1)
}

if (wanted(2)) {
  heading(2, `Pack app.js for this machine (${host})`, 'and read the header without running it')
  const dir = fresh('desktop')
  node(pack, '--host', host, '--out', join(dir, 'app.bundle'), 'app.js')
  node(join(here, 'probes/header.mjs'), join(dir, 'app.bundle'), '/node_modules/bare-dns/binding.js')
  node(pack, '--host', host, '--out', join(dir, 'again.bundle'), 'app.js')
  const same = readFileSync(join(dir, 'app.bundle')).equals(readFileSync(join(dir, 'again.bundle')))
  console.log(`\n  packed again: ${same ? 'byte-identical' : 'DIFFERENT'}`)
}

if (wanted(3)) {
  heading(3, 'Run it from somewhere else', 'the prebuilds are inside the bundle')
  const dir = fresh('embedded')
  node(pack, '--host', host, '--out', join(dir, 'app.bundle'), 'app.js')
  const away = elsewhere()
  cpSync(join(dir, 'app.bundle'), join(away, 'app.bundle'))
  bareHead('app.bundle', away, 1)
  const r = spawnSync(process.execPath, [shim, 'app.bundle'], { cwd: away, encoding: 'utf8' })
  rmSync(away, { recursive: true, force: true })
  const cause = r.stderr.split('\n').find((line) => line.includes('[cause]'))
  if (cause) console.log('  cause: ' + cause.replace(/\(\/.*$/, '').replace(/^.*\[cause\]: /, '') + '…')
  const errno = r.stderr.match(/errno=(\d+)/)
  if (errno) console.log(`  errno=${errno[1]}: the path runs through app.bundle, which is a file, not a directory`)
}

if (wanted(4)) {
  heading(4, 'Offload the addons', 'bundle plus real files beside it, copied anywhere')
  const dir = fresh('offload')
  node(pack, '--host', host, '--offload-addons', '--out', join(dir, 'app.bundle'), 'app.js')
  const listing = spawnSync('find', ['.', '-type', 'f'], { cwd: dir, encoding: 'utf8' }).stdout.trim().split('\n').sort()
  console.log(`  wrote ${listing.length} files: app.bundle and ${listing.length - 1} .bare prebuilds beside it`)
  const away = elsewhere()
  cpSync(dir, away, { recursive: true })
  bare('app.bundle', away)
  rmSync(away, { recursive: true, force: true })
}

if (wanted(5)) {
  heading(5, 'Pack for phones', '--preset mobile: names instead of native bytes')
  const dir = fresh('mobile')
  node(pack, '--preset', 'mobile', '--out', join(dir, 'app.bundle'), 'app.js')
  node(join(here, 'probes/header.mjs'), join(dir, 'app.bundle'), '/node_modules/bare-dns/binding.js')
  console.log(`\n  the phone bundle, run on this ${host} machine:`)
  bareHead('app.bundle', dir, 1)
}

if (wanted(6)) {
  heading(6, 'Make the libraries those names point at', 'bare-link, for one Android and one iOS host')
  const dir = fresh('linked')
  const linked = spawnSync(process.execPath, [link, '--host', 'android-arm64', '--host', 'ios-arm64', '--out', dir, '.'], { cwd: here, encoding: 'utf8' })
  if (linked.status !== 0) {
    console.log(`  bare-link failed with exit status ${linked.status}:`)
    for (const line of linked.stderr.trimEnd().split('\n')) console.log('  ' + line)
    process.exit(1)
  }
  const so = readdirSync(join(dir, 'arm64-v8a')).sort()
  const fw = readdirSync(dir).filter((name) => name.endsWith('.framework')).sort()
  console.log(`  ${so.length} Android libraries in arm64-v8a/, ${fw.length} iOS frameworks`)
  for (const name of so.filter((n) => n.includes('bare-dns'))) console.log('    arm64-v8a/' + name)
  for (const name of fw.filter((n) => n.includes('bare-dns'))) console.log('    ' + name + '/' + name.replace('.framework', ''))

  const mobile = join(out, 'mobile', 'app.bundle')
  if (!existsSync(mobile)) node(pack, '--preset', 'mobile', '--out', mobile, 'app.js')
  const names = spawnSync(process.execPath, ['-e', `
    const b = require('fs').readFileSync(process.argv[1]); let d = 0
    while (b[d] >= 0x30 && b[d] <= 0x39) d++
    const h = JSON.parse(b.toString('utf8', d, d + Number(b.toString('utf8', 0, d))))
    console.log(JSON.stringify(h.addons))`, mobile], { encoding: 'utf8' }).stdout
  const wantedNames = JSON.parse(names).map((u) => u.slice('linked:'.length))
  const made = new Set([...so, ...fw.map((f) => f + '/' + f.replace('.framework', ''))])
  const missing = wantedNames.filter((n) => !made.has(n))
  console.log(`\n  linked: names in the phone bundle: ${wantedNames.length}; missing from bare-link's output: ${missing.length}`)
  console.log(`  made but never named by the bundle: ${made.size - wantedNames.length + missing.length}`)
}

if (wanted(7)) {
  heading(7, 'One executable, no node_modules', 'bare-build --standalone')
  const buildBin = join(here, 'standalone', 'node_modules', 'bare-build', 'bin.js')
  if (!existsSync(buildBin)) {
    console.log('  skipped: bare-build installs a Bare executable for all 13 hosts')
    console.log('  (about 1 GB). Run `npm run probe:standalone` to install it and run this.')
  } else {
    const dir = fresh('standalone')
    spawnSync(process.execPath, [buildBin, '--standalone', '--host', host, '--out', dir, 'app.js'], { cwd: here })
    const exe = join(dir, readdirSync(dir)[0])
    console.log(`  ${exe.split(here).join('<lab>')}: ${statSync(exe).size.toLocaleString('en')} bytes`)
    if (process.platform === 'darwin') {
      const load = spawnSync('otool', ['-l', exe], { encoding: 'utf8' }).stdout.split('\n')
      const at = load.findIndex((line) => line.trim() === 'sectname __bundle')
      if (at !== -1) console.log(`  the bundle rides in section ${load[at + 1].trim().split(/\s+/)[1]},__bundle: ${Number(load[at + 3].trim().split(/\s+/)[1]).toLocaleString('en')} bytes`)
    }
    // The executable unpacks its addons into a directory named after the app
    // and the bundle's id; clearing old ones makes "first start" true.
    for (const name of readdirSync(tmpdir())) {
      if (name.startsWith('lab-05-bundle-')) rmSync(join(tmpdir(), name), { recursive: true, force: true })
    }
    console.log('  run from / :')
    run(exe, [], '/')
    for (const name of readdirSync(tmpdir()).filter((n) => n.startsWith('lab-05-bundle-'))) {
      const files = spawnSync('find', [name, '-name', '*.bare'], { cwd: tmpdir(), encoding: 'utf8' }).stdout.trim().split('\n')
      console.log(`  $TMPDIR/${name.slice(0, 26)}…/  ${files.length} .bare files, written on first start`)
    }
  }
}

if (wanted(8)) {
  heading(8, 'A specifier the packer cannot read', 'require(name), with name in a variable')
  const dir = fresh('dynamic')
  node(pack, '--host', host, '--out', join(dir, 'dyn.bundle'), 'probes/dyn.js')
  console.log('  inside the lab, with the lab\'s node_modules two folders up:')
  bareHead('dyn.bundle', dir, 1)
  const away = elsewhere()
  cpSync(join(dir, 'dyn.bundle'), join(away, 'dyn.bundle'))
  console.log('\n  copied to an empty folder:')
  bareHead('dyn.bundle', away, 1)
  rmSync(away, { recursive: true, force: true })
}

console.log('\n' + '─'.repeat(72))
console.log('  Post: Bare From the Inside, Part 5 — One Bundle Per Host')
console.log('─'.repeat(72) + '\n')
