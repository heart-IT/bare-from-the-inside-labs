// A wakeup deadline is a ceiling, not an allowance.
//
// bare_runtime__on_wakeup (bare/src/runtime.c:375-432) sets the state to awake,
// uv_unrefs the signal handle to unpark the loop, and starts the one timer the
// runtime keeps for itself (:388). When that timer fires,
// bare_runtime__on_wakeup_timeout (:361-372) sets the state to idle and calls
// uv_stop — whether or not your work finished.
//
// That is the asymmetry between the two numbers in this part. `linger` is
// advisory: on_suspend hands it to your listeners, to each child thread and to
// the embedder callback, and nothing starts a timer with it. `deadline` is the
// only interval the runtime enforces, and `uv_timer_start` appears exactly once
// in runtime.c to prove it.
//
// A deadline closes the window; it does not cancel your work. Whatever was
// pending stays on the timer heap and runs the next time the handle is armed —
// watch A's 300 ms finish long after A's window ended. Each window therefore
// gets its own runtime, run one after the other, or the leftovers of one would
// land in the middle of the next.
const t0 = Date.now()
const at = () => `${String(Date.now() - t0).padStart(4)} ms`

function window (label, deadline, work) {
  return new Bare.Thread({ data: { t0, label, deadline, work } }, () => {
    const { t0, label, deadline, work } = Bare.Thread.self.data
    const at = () => `${String(Date.now() - t0).padStart(4)} ms`
    let n = 0

    Bare.on('idle', () => {
      if (n++ === 0) {
        console.log(at(), `  [${label}] idle — asking for ${deadline} ms and starting ${work} ms of work in it`)
        Bare.wakeup(deadline)
      } else {
        console.log(at(), `  [${label}] idle again — window closed, ${work} ms of work ${work > deadline ? 'still pending' : 'already done'}`)
        Bare.resume()
      }
    })

    Bare.on('wakeup', (d) => {
      console.log(at(), `  [${label}] wakeup, deadline ${d}`)
      setTimeout(() => console.log(at(), `  [${label}] the ${work} ms of work finished`), work)
      if (work > deadline) console.log(at(), `  [${label}] ...which is ${work - deadline} ms more than the budget`)
    })

    Bare.suspend()
  })
}

console.log(at(), '[main] A: 100 ms of budget, 300 ms of work')
const a = window('A', 100, 300)
setTimeout(() => {
  a.join()
  console.log(at(), '[main] A joined — the deadline closed the window; it did not cancel the work')

  console.log(at(), '[main] B: 200 ms of budget, 30 ms of work')
  const b = window('B', 200, 30)
  setTimeout(() => { b.join(); console.log(at(), '[main] B joined — the loop emptied first, so the deadline was never reached') }, 400)
}, 400)
