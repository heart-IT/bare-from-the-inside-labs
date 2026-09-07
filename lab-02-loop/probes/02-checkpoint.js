// The whole point of the lab. This file runs twice — once under Bare, once
// under Node — and the two disagree.
//
// Both timeouts share one deadline, so they come due in the same libuv timer
// phase. (With `0` the demo is a coin flip: a zero delay is clamped to 1 ms
// and two timers armed microseconds apart can straddle a millisecond
// boundary. An explicit shared deadline removes the luck.)
//
// Given that, bare-timers drains its expired heap in one call from C, so both
// callbacks run inside a single entry into JavaScript. libjs only drains
// microtasks when the stack returns to depth one (libjs/src/js.cc:1732-1748),
// so the promise waits for the whole batch.
//
// Node re-enters JavaScript per timer callback, so its checkpoint falls
// between them. Neither is wrong; they batch differently.
setTimeout(() => {
  console.log('t1')
  Promise.resolve().then(() => console.log('t1-micro'))
}, 50)

setTimeout(() => console.log('t2'), 50)
