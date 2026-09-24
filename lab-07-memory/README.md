# lab-07-memory

Companion lab for **Bare From the Inside — Part 7: Who Owns This Memory?**

Six probes on memory that crosses between C and JavaScript. The lab compiles
one C addon, `addon/own.c`, and uses it to keep a JavaScript value past its
call in a static (and get back a value nobody passed), then in references with
count 1 and count 0; to lend bytes to JavaScript as an external `ArrayBuffer`
whose finalizer frees them, and to lend stack bytes for one call and detach
them; to free lent bytes too early, built plainly and then with
AddressSanitizer; to hide a pointer in an object with `js_wrap`; and to see
what still runs when the environment is destroyed. The last probe encodes one
frame with `bare-ffmpeg` and looks at its handles.

## Run it

```sh
npm install
npm start
```

One probe at a time:

```sh
npm run probe:handles
npm run probe:lend
npm run probe:early-free
npm run probe:wrap
npm run probe:exit
npm run probe:ffmpeg
```

Needs a C compiler: on macOS, the Xcode Command Line Tools
(`xcode-select --install`), which also bring AddressSanitizer's runtime.
Probes 1–5 use Apple clang's flags and insert the sanitizer with
`DYLD_INSERT_LIBRARIES`, so they run on macOS only and print that they were
skipped anywhere else. Probe 3's sanitized run starts the `bare-runtime` binary
directly rather than through the `bare` shim, because the sanitizer's runtime
must be in the process before the addon is, and the shim is a Node program.

`bare-ffmpeg` ships FFmpeg for 13 hosts, about 420 MB, so it lives in
`ffmpeg/` and `npm start` skips probe 6 until it is installed.
`npm run probe:ffmpeg` installs it and runs the probe; the transcript below
includes it.

Tested on macOS (darwin-arm64) with Node.js 18.20.8, 20.19.4 and 22.21.0,
which printed the same output. `npm install` is about 90 MB, most of it the
Bare binary.

Everything the probes build goes to `out/`, which the first probe of a run
recreates.

## What you will see

The probes run under the pinned shim as `node node_modules/bare/bin/bare
--expose-gc`, which gives scripts a `gc()` that asks the engine for a full
collection. AddressSanitizer's report is cut to its kind and the two frames in
`own.c`: its addresses, thread ids and engine frames change from run to run.

When the runtime is killed by a signal, the shim exits with 128 plus the
signal's number, and the driver names the signal.

```

────────────────────────────────────────────────────────────────────────
  1. A handle kept past its call
     a static js_value_t *, then a js_ref_t with count 1 and with count 0
────────────────────────────────────────────────────────────────────────
  keep({ peer: 'alice' }), then kept() → 0
  a reference with count 1, after gc() → { peer: 'bob' }
  a reference with count 0, before gc() → { peer: 'bob' }
  a reference with count 0, after gc() → null

────────────────────────────────────────────────────────────────────────
  2. Bytes C lends, bytes C borrows
     an external ArrayBuffer with a finalizer, then one detached after the call
────────────────────────────────────────────────────────────────────────
  lend() → ArrayBuffer { byteLength: 16 } "lent by C"
  after gc(): finalizer for the lent bytes: env is NULL, on another thread
  inside borrow(): 16 bytes, "on C's stack"
  after borrow() returned: 0 bytes, detached: true

────────────────────────────────────────────────────────────────────────
  3. Bytes freed while JavaScript still holds them
     the same probe, built plainly and then with AddressSanitizer
────────────────────────────────────────────────────────────────────────
  built plainly:
  lendAndFree() → ArrayBuffer { byteLength: 16 }
  text(bytes) is "lent by C" → false
  exit status 0

  built with -fsanitize=address:
  lendAndFree() → ArrayBuffer { byteLength: 16 }
  ERROR: AddressSanitizer: heap-use-after-free
  READ of size 1 thread T0
    in text own.c:133
  freed by thread T0 here
    in lend_and_free own.c:116
  killed by SIGABRT

────────────────────────────────────────────────────────────────────────
  4. A pointer wrapped in an object
     js_wrap, js_unwrap, and the finalizer after the object is collected
────────────────────────────────────────────────────────────────────────
  unwrap(peer) → alice
  Reflect.ownKeys(peer) → [ 'name' ]
  wrap(peer) again → Object is already wrapped
  unwrap(Object.create(peer)) → Object is not wrapped
  after gc(): finalizer for bob: env is set, on the JS thread

────────────────────────────────────────────────────────────────────────
  5. What runs when the environment is destroyed
     a wrapped object and lent bytes still alive when the script ends
────────────────────────────────────────────────────────────────────────
  the script ends with carol wrapped and the lent bytes still referenced
  after the last line, on stderr:
  teardown callback: the environment is being destroyed
  finalizer for the lent bytes: env is NULL, on the JS thread
  exit status 0

────────────────────────────────────────────────────────────────────────
  6. Showcase: bare-ffmpeg
     one 64×64 frame encoded to JPEG, and a frame used after destroy()
────────────────────────────────────────────────────────────────────────
  frame._handle → ArrayBuffer { byteLength: 8 }
    its 8 bytes are an address: true
  packet.data → 223 bytes, from <Buffer ff d8> to <Buffer ff d9>
    read twice, same memory: false
  after the block: frame._handle → null · packet._handle → null

  frame.destroy(), then frame.width
  exit status 139: the binary was killed by SIGSEGV

────────────────────────────────────────────────────────────────────────
  Post: Bare From the Inside, Part 7 — Who Owns This Memory?
────────────────────────────────────────────────────────────────────────
```

## Verified against

`bare` 1.33.5 (shim) resolving `bare-runtime` 1.33.4 · `bare-headers` 1.33.2 ·
`bare-ffmpeg` 1.6.0 · Apple clang 21.0.0 with AddressSanitizer — checked
2026-09-24, darwin-arm64. The exact dependency trees are pinned by
`package-lock.json` and `ffmpeg/package-lock.json`.
