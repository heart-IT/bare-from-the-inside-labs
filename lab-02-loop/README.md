# lab-02-loop

Companion lab for **Bare From the Inside — Part 2: What Actually Runs**.

Four probes on the loop that decides when your program is over: the coarse
ordering, where the microtask checkpoint falls, `beforeExit` as a question the
loop asks repeatedly, and every way a Bare program can end.

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
```

Needs Node.js 18+ on macOS or Linux. Node launches things; probes 1–3 run under
Bare, and probe 2 runs under both so you can see the two disagree.

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
     bare.js:178-186 prints and calls abort(). Not exit — abort, so no exit event

same throw, one listener
  handled: boom
  -> exit code 0
     the first line of that policy returns early when a listener handles it
```

## What each probe is for

**1 — Ordering.** Synchronous code, then the microtask queue at the first
return to depth one, then libuv's phases. There is deliberately no
`setImmediate` here: a top-level `setImmediate` races the timer phase, so its
position relative to `timeout` changes between runs — in both runtimes. A probe
whose output is a coin flip teaches nothing.

**2 — The checkpoint.** The reason this lab exists. One file, run under Bare and
under Node, printing two different orders.

Both timeouts share a 50 ms deadline, so they come due in the same libuv timer
phase. `bare-timers` drains its expired-timeout heap in a single call from C, so
both callbacks execute inside one entry into JavaScript. libjs only runs
microtasks when the stack returns to **depth one** —
`if (depth == 1 || always_checkpoint) run_microtasks()`, `libjs/src/js.cc:1741`
at the commit Bare pins — so the promise scheduled by the first callback waits
for the second. Node re-enters JavaScript per timer callback, so its checkpoint
falls between them.

The shared deadline matters. Write `0` instead of `50` and the demo becomes a
coin flip: a zero delay is clamped to one millisecond, and two timers armed
microseconds apart can land either side of a millisecond boundary. Roughly one
run in twenty then batches them differently. An explicit deadline removes the
luck.

**3 — Drain.** `bare_runtime_run` (`bare/src/runtime.c:1613-1641`) emits
`beforeExit` *inside* its `do/while` and then re-tests `uv_loop_alive`. A
listener that schedules work sends the loop around again and gets asked again.
`exit` is emitted after the loop, so it fires once regardless.

**4 — Exit paths.** Five separate processes, because the exit code is the
answer. Note the last two: the same throw costs 134 with no listener and 0 with
one, because Bare's entire uncaught-exception policy is nine lines
(`bare/src/bare.js:178-186`) whose first line returns early if a listener
handled it and whose last line is `abort()` — not `exit`, which is why the
`exit` event never fires and the code is 134.

## Notes

The driver resolves the Bare shim through the `bare` package entry point rather
than `node_modules/.bin`, so the lab runs the pinned version even if npm made no
bin link and even if you have a different `bare` on your `PATH`.

Every probe's output is stable: the full run was executed 20 consecutive times
and hashed identical each time.

## Verified against

Bare 1.31.2 source · `bare-runtime` 1.31.0 binary · libjs at commit `56f14ed` ·
darwin-arm64 · Node 22.21.0 — checked 2026-09-07.
