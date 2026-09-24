# lab-02-loop

Companion lab for **Bare From the Inside — Part 2: What Actually Runs**.

Five probes on the loop that decides when your program is over: the coarse
ordering, where the microtask checkpoint falls, `beforeExit` as a question the
loop asks repeatedly, every way a Bare program can end, and the loop's to-do
list printed with `bare-walk-handles`.

## Run it

```sh
npm install
npm start
```

One probe at a time:

```sh
npm run probe:ordering
npm run probe:checkpoint
npm run probe:drain
npm run probe:exit
npm run probe:handles
```

Tested with Node.js 18.20.8, 20.19.4 and 22.21.0 on macOS. Node launches
things; probes 1–3 and 5 run under Bare, and probe 2 runs under both so you can
see the two disagree.

## What you will see

```
────────────────────────────────────────────────────────────────────────
  1. The coarse order
     sync, then microtasks, then libuv phases
────────────────────────────────────────────────────────────────────────
sync
promise
microtask
timeout

────────────────────────────────────────────────────────────────────────
  2. Where the checkpoint falls
     one file, two runtimes, two answers
────────────────────────────────────────────────────────────────────────
under Bare:
t1
t2
t1-micro

under Node:
t1
t1-micro
t2

  Both timeouts are due together. Bare drains the whole expired
  batch in one entry into JavaScript, so the promise scheduled by
  the first waits for the second. Node re-enters per callback.

────────────────────────────────────────────────────────────────────────
  3. beforeExit is a question, not an event
     asked again every time the loop drains
────────────────────────────────────────────────────────────────────────
beforeExit 0
beforeExit 1
beforeExit 2
exit

  Three times, because the first two listeners each gave libuv
  something to wait for. `exit` sits outside the do/while: once.

────────────────────────────────────────────────────────────────────────
  4. Every way this ends
     and what each one costs
────────────────────────────────────────────────────────────────────────
clean drain
  exit 0
  -> exit code 0
     the loop ran dry; exit fired with the code nobody changed

Bare.exitCode = 7
  -> exit code 7
     a field, read at teardown — the program still ended normally

Bare.exit(3), timer pending
  exit 3
  -> exit code 3
     JS execution stops here: beforeExit is skipped and the timer is dropped

uncaught throw
  -> exit code 134
     bare.js:178-190 prints and calls abort(). Not exit — abort, so no exit event

same throw, one listener
  handled: boom
  -> exit code 0
     the first line of that policy returns early when a listener handles it


────────────────────────────────────────────────────────────────────────
  5. The to-do list, printed
     bare-walk-handles at five moments, around a timer and a TCP server
────────────────────────────────────────────────────────────────────────
start            13 handles · keeping it alive: PREPARE
timer set        13 handles · keeping it alive: PREPARE TIMER
server listening 14 handles · keeping it alive: PREPARE TIMER TCP
timer cleared    14 handles · keeping it alive: PREPARE TCP
server closed    13 handles · keeping it alive: PREPARE
exit

  None of the thirteen handles is yours. Six are unref'd and most of the
  rest are inactive, so only active, ref'd handles count. PREPARE is the
  engine's own: always ref'd, active only while it has tasks queued or
  the loop is busy, and the program ended once it was the last one left.

────────────────────────────────────────────────────────────────────────
  Post: https://heartit.tech/bare-from-the-inside-part-2-what-actually-runs/
────────────────────────────────────────────────────────────────────────
```

## What each probe is for

**1 — Ordering.** Synchronous code, then the microtask queue at the first
return to depth one, then libuv's phases. There is deliberately no
`setImmediate` here: a top-level `setImmediate` races the timer phase, so its
position relative to `timeout` changes between runs — in both runtimes. A probe
whose output is a coin flip teaches nothing.

**2 — The checkpoint.** The reason this lab exists. One file, run under Bare and
under Node, printing two different orders.

Both timeouts ask for 50 ms, so they almost always come due in the same libuv
timer phase. `bare-timers` drains its expired-timeout heap in a single call from C, so
both callbacks execute inside one entry into JavaScript. libjs only runs
microtasks when the stack returns to **depth one** —
`if (depth == 1 || always_checkpoint) run_microtasks()`, `libjs/src/js.cc:1757`
at commit `72de271`, the one Bare 1.33.5 pins — so the promise scheduled by the first callback waits
for the second. Node re-enters JavaScript per timer callback, so its checkpoint
falls between them.

The order is usual, not guaranteed. Each `setTimeout` reads the clock when it
is called (`bare-timers/index.js:101-103`), so if a millisecond ticks over
between the two calls they get different deadlines and can come due on
different passes; then Node's order appears. That happened in 3 of 1,000 runs
at 50 ms, and in up to four runs out of forty with a delay of `0`.

**3 — Drain.** `bare_runtime_run` (`bare/src/runtime.c:1952-1988`) emits
`beforeExit` *inside* its `do/while` and then re-tests `uv_loop_alive`. A
listener that schedules work sends the loop around again and gets asked again.
`exit` is emitted after the loop, so it fires once regardless.

**4 — Exit paths.** Five separate processes, because the exit code is the
answer. Note the last two: the same throw costs 134 with no listener and 0 with
one, because Bare's entire uncaught-exception policy is thirteen lines
(`bare/src/bare.js:178-190`). It returns early when a listener handled the
error, and otherwise falls through to `abort()` — not `exit`, which is why the
`exit` event never fires and the code is 134.

Those thirteen lines were nine until Bare 1.32.0. The four that were added are
an outer `try` around the `uncaughtException` emit, so a handler that throws
replaces the original error and falls through to the same single abort instead
of re-entering the crash path. On a 1.31.x binary that same program recursed
until the stack overflowed and died at 133 with no output at all.

**5 — The to-do list.** `bare-walk-handles` lists every libuv handle on the
loop, with whether it is active and whether it is ref'd. libuv counts a handle
toward keeping the loop alive only when it is both — `uv__handle_start` and
`uv__handle_ref` add to `loop->active_handles` only in that case
(`libuv/src/uv-common.h:288-310` at v1.52.1), and `uv__loop_alive` tests that
counter (`libuv/src/unix/core.c:393-398`), alongside active requests, the
pending-callback queue and closing handles, none of which this package lists.
So the probe names only active, ref'd handles.

Thirteen handles exist before your code does anything, and one is both active
and ref'd. Six are unref'd — libjs's task-runner and environment handles, Bare's
sleep-request and wakeup-deadline handles, and the `bare` command's SIGUSR1
signal handle — and the rest are inactive until something uses them.
`setTimeout` does not add a handle: `bare-timers`
created its `uv_timer`, `uv_check` and `uv_idle` when it loaded
(`bare-timers/binding.c:259-265`, called once from the `Scheduler` at
`index.js:300`), and the first timeout makes the timer active. The TCP server adds
one, and closing it removes it.

The handle that never leaves the list is libjs's `uv_prepare`, started when the
environment is created (`libjs/src/js.cc:1490-1493`). Its callback runs the
engine's queued tasks and then stops the handle if none are left
(`js.cc:1866-1878`, called from `on_prepare` at `:1886`); `on_check` starts it
again whenever the loop is still alive for another reason (`:1895-1899`). It is
never unref'd; it is active while the engine has tasks queued or something else
keeps the loop alive, and it stops itself once neither holds — which is why the
program exits right after the last line shows only `PREPARE`.

## Notes

The driver resolves the Bare shim through the `bare` package entry point rather
than `node_modules/.bin`, so the lab runs the pinned version even if npm made no
bin link and even if you have a different `bare` on your `PATH`.

Every probe's output is stable: the full run was executed 20 consecutive times
under Node 22.21.0 and 10 each under 18.20.8 and 20.19.4, and hashed identical
each time.

Probe 5's handle totals (13 and 14) were measured on darwin-arm64. They count
every handle Bare, libjs and the loaded packages created, so another platform
may print different totals.

## Verified against

Bare 1.33.5 source · `bare` 1.33.5 shim · `bare-runtime` 1.33.4 binary ·
`bare-timers` 3.2.3 · `bare-walk-handles` 2.1.0 · `bare-tcp` 2.6.1 · libjs at
commit `72de271` · libuv 1.52.1 · darwin-arm64 · Node 18.20.8, 20.19.4 and
22.21.0 — checked 2026-09-24.
