// Every way a Bare program can end, and what each one costs.
//
// Each case is a separate process, because the exit code is the answer. Run
// from Node so we can read the code the shim forwards back.
import { spawnSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const shim = join(dirname(require.resolve('bare')), 'bin', 'bare')

const cases = [
  {
    name: 'clean drain',
    expect: 0,
    why: 'the loop ran dry; exit fired with the code nobody changed',
    src: 'Bare.on("exit", c => console.log("  exit", c))'
  },
  {
    name: 'Bare.exitCode = 7',
    expect: 7,
    why: 'a field, read at teardown — the program still ended normally',
    src: 'Bare.exitCode = 7'
  },
  {
    name: 'Bare.exit(3), timer pending',
    expect: 3,
    why: 'JS execution stops here: beforeExit is skipped and the timer is dropped',
    src:
      'Bare.on("beforeExit", () => console.log("  beforeExit")); ' +
      'Bare.on("exit", c => console.log("  exit", c)); ' +
      'setTimeout(() => console.log("  never"), 50); ' +
      'Bare.exit(3); console.log("  not printed")'
  },
  {
    name: 'uncaught throw',
    expect: 134,
    why: 'bare.js:178-190 prints and calls abort(). Not exit — abort, so no exit event',
    src: 'Bare.on("exit", () => console.log("  exit listener")); throw new Error("boom")'
  },
  {
    name: 'same throw, one listener',
    expect: 0,
    why: 'the first line of that policy returns early when a listener handles it',
    src:
      'Bare.on("uncaughtException", e => console.log("  handled:", e.message)); ' +
      'setTimeout(() => { throw new Error("boom") }, 1)'
  }
]

for (const c of cases) {
  console.log(`${c.name}`)
  const r = spawnSync(process.execPath, [shim, '-e', c.src], {
    stdio: ['ignore', 'inherit', 'ignore']
  })
  const ok = r.status === c.expect ? '' : `  << expected ${c.expect}`
  console.log(`  -> exit code ${r.status}${ok}`)
  console.log(`     ${c.why}`)
  console.log('')
}
