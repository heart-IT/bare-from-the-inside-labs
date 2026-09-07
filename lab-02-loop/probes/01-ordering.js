// The coarse order: synchronous code, then the microtask queue, then libuv's
// phases. Nothing here is surprising yet — it is the baseline probe 2 breaks.
//
// No setImmediate here on purpose: a top-level setImmediate races the timer
// phase, so its position relative to `timeout` is not stable across runs. A
// probe whose output changes between runs teaches nothing.
setTimeout(() => console.log('timeout'), 0)
Promise.resolve().then(() => console.log('promise'))
queueMicrotask(() => console.log('microtask'))
console.log('sync')
