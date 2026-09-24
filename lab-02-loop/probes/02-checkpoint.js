// The whole point of the lab. This file runs twice — once under Bare, once
// under Node — and the two disagree.
//
// Both timeouts ask for the same delay, so they almost always come due in the
// same libuv timer phase. Each call reads the clock, though, so if a
// millisecond ticks over between them they can land on different passes; a
// longer delay does not remove that.
//
// When they do share a pass, bare-timers drains its expired heap in one call from C, so both
// callbacks run inside a single entry into JavaScript. libjs only drains
// microtasks when the stack returns to depth one (libjs/src/js.cc:1748-1764),
// so the promise waits for the whole batch.
//
// Node runs a microtask checkpoint between timer callbacks, so the promise
// runs between them. Neither is wrong; they place the checkpoint differently.
setTimeout(() => {
  console.log('t1')
  Promise.resolve().then(() => console.log('t1-micro'))
}, 50)

setTimeout(() => console.log('t2'), 50)
