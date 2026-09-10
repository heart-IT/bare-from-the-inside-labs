# lab-03-lifecycle

Companion lab for **Bare From the Inside — Part 3: Suspend Is Not Pause**.

Five probes on the five lifecycle states: what `Bare.suspend()` actually does to
a running program, why a loop with work left can never reach `idle`, the single
`uv_ref` that parks it, the one interval the runtime enforces, and how one
suspend reaches a runtime nobody addressed.

## Run it

```sh
npm install
npm start
```

One probe at a time:

```sh
npm run probe:request
npm run probe:drain
npm run probe:parked
npm run probe:deadline
npm run probe:cascade
```

Needs Node.js 18+ on macOS or Linux. Node launches things; every probe runs
under Bare. Every probe ends itself — nothing here needs killing.

The millisecond figures below drift by a few between runs. The orderings and the
magnitudes do not, and they are the point.

## What you will see

```
────────────────────────────────────────────────────────────────────────
  1. Suspend is a request, not a statement
     the next line runs, and so does a pending timer
────────────────────────────────────────────────────────────────────────
statement after suspend ran at 0 ms
suspend, linger 500 at 1 ms
300 ms timer fired at 301 ms
idle at 301 ms
resume at 301 ms
exit at 301 ms

  The statement after Bare.suspend() ran, and it ran before the
  'suspend' event: the request is two flags and a uv_async_send, read
  on the loop's next turn. The 300 ms timer fired 200 ms inside a
  500 ms linger, because nothing starts a timer with linger.

────────────────────────────────────────────────────────────────────────
  2. Nothing is suspended until the loop is empty
     ticking for 2 s in the suspending state, then leaving via Bare.exit
────────────────────────────────────────────────────────────────────────
suspend, linger 500 — now waiting for a drain that never comes
tick at 201 ms
tick at 402 ms
tick at 603 ms
tick at 804 ms
tick at 1005 ms
tick at 1207 ms
tick at 1407 ms
tick at 1608 ms
tick at 1809 ms
2001 ms — still suspending, never idle. Leaving via Bare.exit.

  on_suspend closes no handle and stops no timer. A ref'd interval
  means uv_run never returns, so the branch that would emit 'idle'
  is never reached. Suspension is a protocol, not an enforcement.

────────────────────────────────────────────────────────────────────────
  3. Idle is one uv_ref, and another thread lifts it
     two children: one arms a timer on the way down, one does not
────────────────────────────────────────────────────────────────────────
   0 ms [main] A: parking a child that arms nothing
   9 ms   [A] parked, 100 ms timer still pending
 409 ms [main] A: 400 ms parked and that timer has not fired. Resuming from this thread.
 409 ms   [A] resumed
 409 ms   [A] the pending 100 ms timer fired
 469 ms [main] A joined — the overdue timer drained on resume, not during the park
 469 ms [main] B: parking a child whose idle listener arms a 50 ms timer
 499 ms   [B] parked, 100 ms timer still pending
 549 ms   [B] timer armed during idle fired
 600 ms   [B] the pending 100 ms timer fired
 898 ms   [B] resumed
 898 ms [main] B joined

  A parked with a timer pending and it stayed pending — bare-timers
  stops its uv handles on 'idle'. B armed one new timer from its idle
  listener, which re-armed the handle that was just stopped, and that
  handle serves the whole heap: B's pending timer fired too. A stop
  is not a lock. Both were freed by the main thread, not by anything
  they could run themselves.

────────────────────────────────────────────────────────────────────────
  4. A wakeup deadline is a ceiling, not an allowance
     and it closes the window without cancelling the work
────────────────────────────────────────────────────────────────────────
   0 ms [main] A: 100 ms of budget, 300 ms of work
   9 ms   [A] idle — asking for 100 ms and starting 300 ms of work in it
   9 ms   [A] wakeup, deadline 100
   9 ms   [A] ...which is 200 ms more than the budget
 110 ms   [A] idle again — window closed, 300 ms of work still pending
 310 ms   [A] the 300 ms of work finished
 409 ms [main] A joined — the deadline closed the window; it did not cancel the work
 409 ms [main] B: 200 ms of budget, 30 ms of work
 432 ms   [B] idle — asking for 200 ms and starting 30 ms of work in it
 432 ms   [B] wakeup, deadline 200
 462 ms   [B] the 30 ms of work finished
 462 ms   [B] idle again — window closed, 30 ms of work already done
 831 ms [main] B joined — the loop emptied first, so the deadline was never reached

  A asked for 100 ms and started 300 ms of work: the deadline stopped
  the loop on time and the work finished afterwards, outside the
  window. B finished early, so the deadline was never reached.

────────────────────────────────────────────────────────────────────────
  5. Suspension cascades; sockets do not
     one Bare.suspend(), two runtimes
────────────────────────────────────────────────────────────────────────
 109 ms [main]   suspend, linger 1234
 109 ms   [thread] suspend, linger 1234 — nobody addressed me
 110 ms   [thread] idle — the interval was the only thing keeping me busy
 260 ms [main]   resume
 260 ms   [thread] resume
 409 ms [main]   joined

  Nobody addressed the child. on_suspend walks the thread list and
  hands each child the same request and the same linger. What it does
  not do is close anything — the child reached 'idle' only because it
  listened and cleared its own interval.

────────────────────────────────────────────────────────────────────────
  Post: https://heartit.tech/bare-from-the-inside-part-3-suspend-is-not-pause/
────────────────────────────────────────────────────────────────────────
```

## What each probe is for

**1 — Request.** `bare_runtime_suspend` (`bare/src/runtime.c:1369-1378`) takes a
mutex, records the linger, sets two flags and `uv_async_send`s the runtime's
signal handle. It touches no JavaScript, which is why the statement after
`Bare.suspend()` runs — and runs *before* the `suspend` event, which has not
been emitted yet. The request is read on the loop's next turn.

One step is missing from those ten lines, because it cannot be done there.
`uv_ref` is not safe to call from another thread and `bare_runtime_suspend`
accepts calls from any thread, so the JavaScript binding does it first
(`:782-805`), and the signal handler gives it back at `:569` unless the loop is
already parked. Without that ref, a program whose last statement is
`Bare.suspend()` could drain and exit before the signal was ever read.

The 300 ms timer fires 200 ms inside a 500 ms linger because nothing starts a
timer with linger: `on_suspend` hands it to your listeners, to each child thread
and to the embedder callback, and forgets it.

**2 — Drain.** `bare_runtime__on_suspend` (`:310-358`) sets the state to
`suspending`, emits the event, cascades, and calls the embedder callback. It
closes no handle and stops no timer, so Part 2's rule still decides everything:
`uv_run` returns when libuv has nothing left, and a `setInterval` means it never
has nothing left. `idle` is unreachable here, and the only way out is the one
from Part 2 — `Bare.exit` stops JavaScript at that statement instead of waiting
for a drain that is not coming.

Killing this probe from the runner would not work even if it tried. The `bare`
on your `PATH` is a six-line Node shim that spawns the real binary as a
grandchild, and `suppressSignals: true` installs no-op signal handlers on the
shim (`bare-runtime/lib/spawn.js`), so nothing is forwarded. A SIGKILL to the
shim orphans the binary, which keeps running and keeps writing to the terminal.

**3 — Parked.** `bare_runtime__on_idle` (`:435-476`) sets the state to
`suspended` and calls `uv_ref` on the signal handle at `:446` — the same handle
`bare_runtime_setup` unref'd so the runtime would never keep your program alive.
A ref'd async handle keeps `uv_loop_alive()` true, so `bare_run`'s `do/while`
calls `uv_run` again and `uv_run` sleeps in its poll phase. Hence the header
(`bare/include/bare.h:104-110`): "`bare_run()` will not return until another
thread resumes the process."

Two children make the next part concrete, and it is the footgun worth taking
away. `bare-timers` stops its three uv handles when `idle` fires
(`bare-timers/index.js:81` → `binding.c:390-412`), so child **A**'s pending
100 ms timer stayed pending for the whole 400 ms park and drained only on
resume. Child **B** is identical except that its `idle` listener schedules one
new 50 ms timer — and `setTimeout` re-arms the very handle that was just
stopped. That handle serves the whole heap, so B's *pending* 100 ms timer fired
too, on schedule, as though the park had never happened. The stop is not a lock.

On a phone that is the difference between a parked worker and one that keeps
working after the platform expected silence.

**4 — Deadline.** `bare_runtime__on_wakeup` (`:375-432`) unparks the loop and
starts the one timer the runtime keeps for itself (`:388`). When it fires,
`bare_runtime__on_wakeup_timeout` (`:361-372`) sets the state to `idle` and
calls `uv_stop`, finished work or not. `uv_timer_start` appears exactly once in
`runtime.c`, and that is the line — which is the proof that `linger` is advisory
and `deadline` is not.

A deadline closes the window; it does not cancel the work. Child **A** asked for
100 ms and started 300 ms of work: the window ended on time at 110 ms and the
work completed afterwards, outside it. Child **B** finished early, so its
deadline was never reached. Each window gets its own runtime here, because
otherwise A's leftovers would land in the middle of B.

**5 — Cascade.** The tail of `on_suspend` walks the runtime's thread list
(`:346-355`) and hands each child the same request with the same linger;
`on_wakeup` and `on_resume` carry the same loop. Nobody addressed the child in
this probe — it is suspended because its parent was.

Notice what the cascade does not do. It closes no socket, cancels no request and
flushes nothing. The child reaches `idle` only because it listens and clears its
own interval; the main thread never does, because it still has timers pending.
That is the two-layer problem on a phone in miniature: react-native-bare-kit
makes this same `Bare.suspend` call for you, and no Holepunch library is
subscribed to the event it produces.

## Notes

The driver resolves the Bare shim through the `bare` package entry point rather
than `node_modules/.bin`, so the lab runs the pinned version even if npm made no
bin link and even if you have a different `bare` on your `PATH`.

Probes 3, 4 and 5 use `Bare.Thread` to get a second runtime to suspend. What a
thread *is* belongs to Part 8; here it is only the cheapest way to have another
loop in the room, and the only way to watch a parked runtime be freed from
outside.

## Verified against

Bare 1.32.0 source · `bare` 1.32.0 shim · `bare-runtime` 1.32.0 binary ·
`bare-timers` 3.2.3 · darwin-arm64 · Node 22.21.0 — checked 2026-09-10.
