// Bare.suspend() is a request, not a statement.
//
// bare_runtime_suspend (bare/src/runtime.c:1369-1378) takes a mutex, records
// the linger, sets two flags, and uv_async_sends the runtime's signal handle.
// It touches no JavaScript, so the statement after it runs — and runs before
// the 'suspend' event, which has not been emitted yet.
//
// Nothing is paused either: the 300 ms timer is a ref'd libuv handle, so the
// loop still has work and 'idle' cannot arrive until the timer has fired.
// The 500 ms linger does not change that. Nothing starts a timer with it
// (`rg -n uv_timer_start src/runtime.c` returns exactly one line, and that
// line is the wakeup deadline).
const t0 = Date.now()
const at = () => `${Date.now() - t0} ms`

Bare.on('suspend', (linger) => console.log('suspend, linger', linger, 'at', at()))
Bare.on('idle', () => { console.log('idle at', at()); Bare.resume() })
Bare.on('resume', () => console.log('resume at', at()))
Bare.on('exit', () => console.log('exit at', at()))

setTimeout(() => console.log('300 ms timer fired at', at()), 300)

Bare.suspend(500)
console.log('statement after suspend ran at', at())
