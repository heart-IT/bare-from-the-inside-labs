// 'idle' is one uv_ref, and only another thread can lift it.
//
// bare_runtime__on_idle (bare/src/runtime.c:435-476) sets the state to
// suspended and calls uv_ref on the signal handle at :446 — the same handle
// bare_runtime_setup unref'd so the runtime would never keep your program
// alive. A ref'd async handle keeps uv_loop_alive() true, so bare_run's
// do/while calls uv_run again and uv_run sleeps in its poll phase.
//
// The header states the consequence (bare/include/bare.h:104-110): "Once the
// process has suspended successfully, `bare_run()` will not return until
// another thread resumes the process."
//
// Two children make that literal, run one after the other so the output does
// not interleave. Both park with a 100 ms timer pending. The difference is
// whether anything arms a *new* timer on the way down — and that difference
// decides the fate of the timer that was already there.
const t0 = Date.now()
const at = () => `${String(Date.now() - t0).padStart(4)} ms`

function park (label, rearm) {
  return new Bare.Thread({ data: { t0, label, rearm } }, () => {
    const { t0, label, rearm } = Bare.Thread.self.data
    const at = () => `${String(Date.now() - t0).padStart(4)} ms`

    setTimeout(() => console.log(at(), `  [${label}] the pending 100 ms timer fired`), 100)

    Bare.on('suspend', () => Bare.idle())

    Bare.on('idle', () => {
      console.log(at(), `  [${label}] parked, 100 ms timer still pending`)

      if (rearm) {
        // bare-timers stopped its uv handles on 'idle' (bare-timers/index.js:81
        // -> binding.c:390-412). This setTimeout calls binding.timeout and
        // re-arms the very handle that was stopped — and that handle services
        // the whole heap, not just this one timeout.
        setTimeout(() => console.log(at(), `  [${label}] timer armed during idle fired`), 50)
      }
    })

    Bare.on('resume', () => console.log(at(), `  [${label}] resumed`))
  })
}

// Child A: park and arm nothing. The pending timer is frozen with the loop.
console.log(at(), '[main] A: parking a child that arms nothing')
const a = park('A', false)
a.suspend(0)

setTimeout(() => {
  console.log(at(), '[main] A: 400 ms parked and that timer has not fired. Resuming from this thread.')
  a.resume()

  setTimeout(() => {
    a.join()
    console.log(at(), '[main] A joined — the overdue timer drained on resume, not during the park')

    // Child B: identical, except the idle listener schedules one new timer.
    console.log(at(), '[main] B: parking a child whose idle listener arms a 50 ms timer')
    const b = park('B', true)
    b.suspend(0)

    setTimeout(() => { b.resume(); b.join(); console.log(at(), '[main] B joined') }, 400)
  }, 60)
}, 400)
