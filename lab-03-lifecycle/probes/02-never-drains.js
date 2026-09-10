// A loop with a live interval never drains, so 'idle' never arrives.
//
// bare_runtime__on_suspend (bare/src/runtime.c:310-358) sets the state to
// suspending, emits 'suspend', cascades to child threads and calls the
// embedder callback. It closes no handle and stops no timer.
//
// So Part 2's rule still decides everything: uv_run returns when libuv has
// nothing left, and a setInterval is a ref'd handle, so it never has nothing
// left. The suspending state only picks which branch bare_run takes *if*
// uv_run returns — and here it never does.
//
// Which leaves exactly one way out, and it is the one from Part 2: Bare.exit
// stops JavaScript at that statement rather than waiting for a drain that is
// not coming. Nothing else in this file could end it.
const t0 = Date.now()
const at = () => `${Date.now() - t0} ms`

const ticker = setInterval(() => console.log('tick at', at()), 200)

Bare.on('suspend', (linger) => console.log(`suspend, linger ${linger} — now waiting for a drain that never comes`))
Bare.on('idle', () => console.log('idle (you will not see this line)'))
Bare.on('beforeExit', () => console.log('beforeExit (nor this one)'))

Bare.suspend(500)

// Not a timeout on the suspension — the runtime has no such thing. This is
// just the probe agreeing to stop, two seconds in, so the lab can continue.
setTimeout(() => {
  clearInterval(ticker)
  console.log(at(), '— still suspending, never idle. Leaving via Bare.exit.')
  Bare.exit(0)
}, 2000)
