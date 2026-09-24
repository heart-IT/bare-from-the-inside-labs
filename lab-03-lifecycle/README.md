# lab-03-lifecycle

Companion lab for **Bare From the Inside — Part 3: Suspend Is Not Pause**.

Seven probes on the five lifecycle states: what `Bare.suspend()` does to a
running program, why a loop with work left can never reach `idle`, the single
`uv_ref` that parks it, the one interval the runtime enforces, how one suspend
reaches a runtime nobody addressed, why a UDP socket from `bare-dgram` is yours
to close, and what happens when several requests land in one pass.

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
npm run probe:socket
npm run probe:one-pass
```

Tested with Node.js 18.20.8, 20.19.4 and 22.21.0 on macOS. Node launches
things; every probe runs under Bare. Every probe ends itself — nothing here
needs killing.

The millisecond figures below vary between runs: by up to about 50 ms in
probes 3, 4 and 5, whose clocks run across child-thread start-ups, and by up to
13 ms elsewhere. Across 110 full runs under Node 22.21.0, plus one fresh
`npm ci && npm start` under each Node version above, every probe exited 0 and
every line and its order matched once each figure and its padding was masked;
the orderings are the point. An earlier batch of 120 runs matched in 119: in one,
probe 3 stopped after child A parked. That has not been reproduced since and its
cause is unknown. If a probe ends with a non-zero status or a signal, the driver
prints it and `npm start` exits 1.

## What you will see

```
────────────────────────────────────────────────────────────────────────
  1. Suspend is a request, not a stop
     the next line runs, and so does a pending timer
────────────────────────────────────────────────────────────────────────
statement after suspend ran at 0 ms
suspend, linger 500 at 1 ms
300 ms timer fired at 301 ms
idle at 301 ms
resume at 302 ms
exit at 302 ms

  The statement after Bare.suspend() ran, and it ran before the
  'suspend' event: the request is two flags and a uv_async_send, read
  on the loop's next pass. The 300 ms timer fired 200 ms inside a
  500 ms linger, because nothing starts a timer with linger.

────────────────────────────────────────────────────────────────────────
  2. Nothing is suspended until the loop is empty
     ticking for 2 s in the suspending state, then leaving via Bare.exit
────────────────────────────────────────────────────────────────────────
suspend, linger 500 — now waiting for a drain that never comes
tick at 201 ms
tick at 402 ms
tick at 603 ms
tick at 803 ms
tick at 1004 ms
tick at 1205 ms
tick at 1406 ms
tick at 1607 ms
tick at 1807 ms
2002 ms — still suspending, never idle. Leaving via Bare.exit.

  on_suspend closes no handle and stops no timer. A ref'd interval
  means uv_run never returns, so the branch that would emit 'idle'
  is never reached. Suspension is an agreement, not an enforcement.

────────────────────────────────────────────────────────────────────────
  3. Idle is one uv_ref, and another thread lifts it
     three children: one arms nothing on the way down, one an earlier timer, one a later one
────────────────────────────────────────────────────────────────────────
   0 ms [main] A: parking a child that arms nothing
  10 ms   [A] parked, 100 ms timer still pending
 410 ms [main] A: 400 ms parked and that timer has not fired. Resuming from this thread.
 410 ms   [A] resumed
 411 ms   [A] the pending 100 ms timer fired
 472 ms [main] A joined — the overdue timer drained on resume, not during the park
 472 ms [main] B: parking a child whose idle listener arms a 50 ms timer
 504 ms   [B] parked, 100 ms timer still pending
 555 ms   [B] 50 ms timer armed during idle fired
 604 ms   [B] the pending 100 ms timer fired
 902 ms   [B] resumed
 902 ms [main] B joined
 902 ms [main] C: parking a child whose idle listener arms a 300 ms timer
 933 ms   [C] parked, 100 ms timer still pending
1331 ms [main] C: 400 ms parked and neither timer has fired. Resuming from this thread.
1332 ms   [C] resumed
1332 ms   [C] the pending 100 ms timer fired
1332 ms   [C] 300 ms timer armed during idle fired
1393 ms [main] C joined

  A parked with a timer pending and it stayed pending — bare-timers
  stops its uv handles on 'idle'. B armed one new timer from its idle
  listener, which re-armed the handle that was just stopped, and that
  handle serves the whole heap: B's pending timer fired too. A stop
  is not a lock. C armed a timer due after the pending one, and a new
  timer restarts the handle only when it is the earliest, so nothing
  fired. All three were freed by the main thread, not by anything
  they could run themselves.

────────────────────────────────────────────────────────────────────────
  4. A wakeup deadline is a maximum, not a duration
     and it closes the window without cancelling the work
────────────────────────────────────────────────────────────────────────
   0 ms [main] A: 100 ms of budget, 300 ms of work
  11 ms   [A] idle — asking for 100 ms and starting 300 ms of work in it
  11 ms   [A] wakeup, deadline 100
  11 ms   [A] ...which is 200 ms more than the budget
 111 ms   [A] idle again — window closed, 300 ms of work still pending
 312 ms   [A] the 300 ms of work finished
 411 ms [main] A joined — the deadline closed the window; it did not cancel the work
 411 ms [main] B: 200 ms of budget, 30 ms of work
 427 ms   [B] idle — asking for 200 ms and starting 30 ms of work in it
 427 ms   [B] wakeup, deadline 200
 458 ms   [B] the 30 ms of work finished
 458 ms   [B] idle again — window closed, 30 ms of work already done
 826 ms [main] B joined — the loop emptied first, so the deadline was never reached

  A asked for 100 ms and started 300 ms of work: the deadline stopped
  the loop on time and the work finished afterwards, outside the
  window. B finished early, so the deadline was never reached.

────────────────────────────────────────────────────────────────────────
  5. Suspension cascades; sockets do not
     one Bare.suspend(), two runtimes
────────────────────────────────────────────────────────────────────────
 110 ms [main]   suspend, linger 1234
 111 ms   [thread] suspend, linger 1234 — nobody addressed me
 111 ms   [thread] idle — the interval was the only thing keeping me busy
 260 ms [main]   resume
 260 ms   [thread] resume
 410 ms [main]   joined

  Nobody addressed the child. on_suspend walks the thread list and
  hands each child the same request and the same linger. What it does
  not do is close anything — the child reached 'idle' only because it
  listened and cleared its own interval.

────────────────────────────────────────────────────────────────────────
  6. A socket is work, and closing it is yours
     one UDP socket, suspended twice: left open, then closed
────────────────────────────────────────────────────────────────────────
  left open:
first socket received "ping"
suspend — leaving the socket open
1 s later — still suspending, never idle. Leaving via Bare.exit.

  closed on suspend, reopened on resume:
first socket received "ping"
suspend — closing the socket
idle
resume — opening a new socket
second socket received "ping"

  bare-dgram listens for no lifecycle event. Left open, its socket
  is receiving, an active ref'd handle, so uv_run never returns;
  the 1 s timer is unref'd and could not be the reason. Closed in the
  suspend listener, the loop empties and idle arrives, and a
  new socket opened on resume works as the first one did.

────────────────────────────────────────────────────────────────────────
  7. Several requests, one pass
     flags, not a queue: a cancelled suspend, then a flick
────────────────────────────────────────────────────────────────────────
  Bare.suspend(); Bare.resume():
suspend
resume
exit

  Bare.suspend(); Bare.resume(); Bare.suspend():
suspend
resume
suspend
idle — resuming so the probe ends
resume
exit

  The signal handler reads every flag at once and applies suspend,
  wakeup, resume, then a second suspend if one came after the resume.
  A resume before the loop empties cancels the suspension, so the
  first run never reaches idle; the flick ends suspending again.

────────────────────────────────────────────────────────────────────────
  Post: https://heartit.tech/bare-from-the-inside-part-3-suspend-is-not-pause/
────────────────────────────────────────────────────────────────────────
```

## What each probe is for

**1 — Request.** `bare_runtime_suspend` (`bare/src/runtime.c:1455-1466`) takes a
mutex, records the linger, sets two flags and `uv_async_send`s the runtime's
signal handle. It touches no JavaScript, which is why the statement after
`Bare.suspend()` runs — and runs *before* the `suspend` event, which has not
been emitted yet. The request is read on the loop's next pass.

One step is missing from those twelve lines, because it cannot be done there.
`uv_ref` is not safe to call from another thread and `bare_runtime_suspend`
accepts calls from any thread, so the JavaScript binding does it first
(`:793-816`), and the signal handler gives it back at `:570` unless the loop is
already parked. Without that ref, a program whose last statement is
`Bare.suspend()` could drain and exit before the signal was ever read.

The 300 ms timer fires 200 ms inside a 500 ms linger because nothing starts a
timer with linger: `on_suspend` hands it to your listeners, to each child thread
and to the embedder callback, and `bare_runtime_suspend` stores it for the
signal handler to read (`:574`) and pass on, including to a resuspend (`:600`).

**2 — Drain.** `bare_runtime__on_suspend` (`:311-359`) sets the state to
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

**3 — Parked.** `bare_runtime__on_idle` (`:436-477`) sets the state to
`suspended` and calls `uv_ref` on the signal handle at `:447` — the same handle
`bare_runtime_setup` unref'd so the runtime would never keep your program alive.
A ref'd async handle keeps `uv_loop_alive()` true, so `bare_run`'s `do/while`
calls `uv_run` again and `uv_run` sleeps in its poll phase. Hence the header
(`bare/include/bare.h:188-194`): "`bare_run()` will not return until another
thread resumes the process."

Three children make the next part concrete, and it is the footgun worth taking
away. `bare-timers` stops its three uv handles when `idle` fires
(`bare-timers/index.js:81` → `binding.c:389-413`), so child **A**'s pending
100 ms timer stayed pending for the whole 400 ms park and drained only on
resume. Child **B** is identical except that its `idle` listener schedules one
new 50 ms timer — and `setTimeout` re-arms the very handle that was just
stopped. That handle serves the whole heap, so B's *pending* 100 ms timer fired
too, on schedule, as though the park had never happened. The stop is not a lock.

It is not a reliable unlock either. `bare-timers` restarts its handle for a new
timer only when that timer is the earliest on its heap (`index.js:107-111`).
Child **C** arms a 300 ms timer, due after the pending 100 ms one, so nothing
restarts: neither timer fires during the park, and both fire on resume, in
expiry order.

On a phone that is the difference between a parked worker and one that keeps
working after the platform expected silence.

**4 — Deadline.** `bare_runtime__on_wakeup` (`:376-433`) unparks the loop and
starts the one timer the runtime keeps for itself (`:389`). When it fires,
`bare_runtime__on_wakeup_timeout` (`:362-373`) sets the state to `idle` and
calls `uv_stop`, finished work or not. `uv_timer_start` appears exactly once in
`runtime.c`, and that is the line — which is the proof that `linger` is advisory
and `deadline` is not.

A deadline closes the window; it does not cancel the work. Child **A** asked for
100 ms and started 300 ms of work: the window closed 100 to 102 ms after it
opened and the work completed afterwards, outside it. Child **B** finished
early, so its deadline was never reached. Each window gets its own runtime
here, because otherwise A's leftovers would land in the middle of B.

**5 — Cascade.** The tail of `on_suspend` walks the runtime's thread list
(`:347-356`) and hands each child the same request with the same linger;
`on_wakeup` and `on_resume` carry the same loop. Nobody addressed the child in
this probe — it is suspended because its parent was.

Notice what the cascade does not do. It closes no socket, cancels no request and
flushes nothing. The child reaches `idle` only because it listens and clears its
own interval; the main thread never does, because it still has timers pending.
That is the two-layer problem on a phone in miniature: react-native-bare-kit
makes this same `Bare.suspend` call for you, and none of Hyperswarm, hyperdht,
dht-rpc or udx-native is subscribed to the event it produces.

**6 — Socket.** `bare-dgram` is Bare's UDP socket package, and its JavaScript
subscribes to no `Bare` lifecycle event: `grep` its `index.js` and `lib/` for
`suspend` or `idle` and nothing comes back. Its native half holds a libuv
`uv_udp_t` (`bare-dgram/binding.c:14`, initialised at `:380`), a ref'd handle
unless you call `socket.unref()`, and binding the socket starts it receiving
(`index.js:641` → `uv_udp_recv_start`, `binding.c:591`), which makes the handle
active. A ref'd, active handle keeps the loop alive, so probe 2's rule applies
to a socket exactly as it applied to an interval: left open, the socket keeps
`uv_run` from returning and `idle` never arrives.

The run that leaves the socket open ends itself with a 1 s timer, and that timer
is `unref()`'d on purpose, so it is not work the loop waits on. Without the
socket, `Bare.suspend()` plus the same unref'd timer reaches `idle`. The socket
is the only thing standing between the first run and `idle`.

The second run closes the socket in its `suspend` listener. The loop empties,
`idle` arrives, the listener calls `Bare.resume()`, and the `resume` listener
binds a brand-new socket that sends and receives a datagram of its own. A closed
socket is not reopened; you make another.

Hyperswarm's transport is also a UDP socket, from `udx-native` rather than
`bare-dgram`, and it too leaves `suspend()` and `resume()` to the app. Same kind
of socket, same rule: the runtime going quiet is something your code does by
closing things.

Both runs are deterministic: ten runs of each produced byte-identical output.

**7 — One pass.** A request is flags and a ping, not a queue entry, so several
can land before the loop reads them. `bare_runtime_suspend` sets `suspend` and
`resuspend`; `bare_runtime_resume` sets `resume` and clears `resuspend`
(`:1481-1490`). The signal handler copies every flag at once and applies them in
a fixed order (`:590-602`): terminate beats everything, otherwise suspend,
wakeup, resume, and after the resume a second suspend if `resuspend` is still
set.

So `Bare.suspend(); Bare.resume()` prints `suspend`, `resume`, `exit` and never
reaches `idle`, as the header promises (`bare/include/bare.h:203-209`): "if the
process is not yet idle after being suspended the suspension will be
cancelled." And a background, foreground, background flick inside one pass,
`Bare.suspend(); Bare.resume(); Bare.suspend()`, ends suspending again and
reaches `idle` once the loop is empty. Its `idle` listener resumes only so the
probe ends itself, as Bare's own `test/suspend-resume-suspend.js` does.

## Notes

The driver resolves the Bare shim through the `bare` package entry point rather
than `node_modules/.bin`, so the lab runs the pinned version even if npm made no
bin link and even if you have a different `bare` on your `PATH`.

Probes 3, 4 and 5 use `Bare.Thread` to get a second runtime to suspend. What a
thread *is* belongs to Part 8; here it is only the cheapest way to have another
loop in the room, and the only way to watch a parked runtime be freed from
outside.

## Verified against

Bare 1.33.5 source · `bare` 1.33.5 shim · `bare-runtime` 1.33.4 binary ·
`bare-timers` 3.2.3 · `bare-dgram` 1.1.1 · darwin-arm64 · Node 18.20.8, 20.19.4
and 22.21.0 — checked 2026-09-24.
