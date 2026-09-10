// One Bare.suspend() on the main thread reaches every child runtime.
//
// The tail of bare_runtime__on_suspend walks the runtime's thread list
// (bare/src/runtime.c:346-355) and calls bare_thread_suspend on each with the
// same linger. on_wakeup and on_resume carry the same loop. Nobody addressed
// the child below; it is suspended because its parent was.
//
// Notice what the cascade does not do. It closes no socket, cancels no request
// and flushes nothing. The runtime moves its own state and emits events; what
// those events *mean* is left to whoever is listening. The child here listens,
// and clearing its interval is the only reason it ever reaches 'idle'. The main
// thread never does, because it still has timers pending.
//
// That is the shape of the two-layer problem on a phone: react-native-bare-kit
// makes this same Bare.suspend call for you, and no Holepunch library is
// subscribed to the event it produces.
const t0 = Date.now()
const at = () => `${String(Date.now() - t0).padStart(4)} ms`

const t = new Bare.Thread({ data: { t0 } }, () => {
  const { t0 } = Bare.Thread.self.data
  const at = () => `${String(Date.now() - t0).padStart(4)} ms`

  const i = setInterval(() => {}, 50)

  Bare.on('suspend', (linger) => {
    console.log(at(), `  [thread] suspend, linger ${linger} — nobody addressed me`)
    clearInterval(i)
  })

  Bare.on('idle', () => console.log(at(), '  [thread] idle — the interval was the only thing keeping me busy'))
  Bare.on('resume', () => console.log(at(), '  [thread] resume'))
})

Bare.on('suspend', (linger) => console.log(at(), `[main]   suspend, linger ${linger}`))
Bare.on('idle', () => console.log(at(), '[main]   idle (you will not see this — timers pending)'))
Bare.on('resume', () => console.log(at(), '[main]   resume'))

setTimeout(() => Bare.suspend(1234), 100)
setTimeout(() => Bare.resume(), 250)
setTimeout(() => { t.join(); console.log(at(), '[main]   joined') }, 400)
