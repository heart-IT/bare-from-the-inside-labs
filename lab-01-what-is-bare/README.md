# lab-01-what-is-bare

Companion lab for **Bare From the Inside — Part 1: Why P2P Needed Its Own Runtime**.

Four probes against a real Bare binary: what version is actually running, what
the `Bare` namespace holds, what `require()` refuses to find, and what
`npm i bare` put on your disk.

## Run it

```sh
npm install
npm start
```

One probe at a time:

```sh
npm run probe:identity
npm run probe:namespace
npm run probe:resolution
npm run probe:distribution
```

Needs Node.js 18+ on macOS or Linux. Node is only used to launch things — the
probes themselves run under Bare.

## What you will see

Paths are shortened to `<lab>` below; yours will be absolute. The exact version
numbers depend on what npm resolves for your platform.

```

────────────────────────────────────────────────────────────────────────
  1. What is actually running?
     the npm version and the binary version may differ
────────────────────────────────────────────────────────────────────────
Bare.version : v1.31.0
Bare.versions: {"bare":"1.31.0","uv":"1.52.1","v8":"14.8.178.31"}
platform/arch: darwin-arm64

────────────────────────────────────────────────────────────────────────
  2. What you get for free
     and the four names with no Node counterpart
────────────────────────────────────────────────────────────────────────
Bare namespace: arch,argv,constructor,exit,exitCode,idle,pid,platform,resume,simulator,suspend,version,versions,wakeup

typeof process    : undefined
typeof fetch      : undefined
typeof TextEncoder: undefined
typeof setTimeout : function (from bare-timers, not the runtime)
typeof Buffer     : function

────────────────────────────────────────────────────────────────────────
  3. What require() can find — from this directory
     node_modules is populated here
────────────────────────────────────────────────────────────────────────
fs           MODULE_NOT_FOUND
node:fs      MODULE_NOT_FOUND
bare-fs      RESOLVED
bare-events  RESOLVED

bare-fs is right there, and `node:fs` still fails: the node: prefix
is stripped and the rest is resolved as an ordinary package name,
so require("node:fs") asks for a package called "fs". There is no
builtin table to consult. See bare-module-resolve/index.js:169-183.

────────────────────────────────────────────────────────────────────────
  3.5. The same probe, from an empty directory
     same binary, same script, nothing on disk beside it
────────────────────────────────────────────────────────────────────────
fs           MODULE_NOT_FOUND
node:fs      MODULE_NOT_FOUND
bare-fs      MODULE_NOT_FOUND
bare-events  MODULE_NOT_FOUND

Nothing resolved. Same binary, same script — the only thing that
changed is the directory it was run from. Resolution walks up from
the file that called require(), and there is no node_modules above
this one. The binary is not where modules come from.

  The script was copied, not re-pointed. Moving the file moved the answer.

────────────────────────────────────────────────────────────────────────
  4. What `npm i bare` actually installed
     a Node shim, and a per-target prebuilt binary
────────────────────────────────────────────────────────────────────────
the `bare` shim npm installed is this file:
  <lab>/node_modules/bare/bin/bare
  6 lines of Node:

    #!/usr/bin/env node
    require('bare-runtime/spawn')(__filename, {
      stdio: 'inherit',
      suppressSignals: true,
      forwardExitCode: true
    })

the real binary it spawns:
  <lab>/node_modules/bare-runtime-darwin-arm64/bin/bare
  exists: true

────────────────────────────────────────────────────────────────────────
  Post: https://heartit.tech/  · Bare From the Inside, Part 1
────────────────────────────────────────────────────────────────────────
```

## What each probe is for

**1 — Identity.** `Bare.version` reports **1.31.0** while `package.json` pins
`bare@1.31.2`. That is not a bug: the npm `bare` package is a shim, and it does
not pin a binary — it declares `bare-runtime` as a peer dependency with the
range `*`, so you get whichever `bare-runtime` npm resolves. This lab pins
`bare-runtime@1.31.0` explicitly so the output above stays reproducible. The
number that matters for behaviour is the one the binary reports.

**2 — Namespace.** Everything you get without installing anything. `process`,
`fetch` and `TextEncoder` are absent. `setTimeout` is present, but it comes
from the `bare-timers` package that the bootstrap installs as a global, not from
the runtime. Four names in that list — `suspend`, `idle`, `resume`, `wakeup` —
have no Node counterpart, and they are the reason this runtime can live on a
phone. Part 3 is about them.

**3 — Resolution.** The probe runs twice, and the difference is the whole point.

From this directory, `bare-fs` resolves — it arrives as a dependency of
`bare-runtime`. And `require('node:fs')` **still fails**, with the filesystem
module sitting right there in `node_modules`. The `node:` prefix is not a
special form; it is stripped, and `fs` is resolved as an ordinary package name
(`bare-module-resolve/index.js:169-183`). There is no builtin table to consult.

Then the same file is copied into an empty temporary directory and run again.
Nothing resolves. The binary never changed. Module resolution walks up from the
file that called `require()`, so moving the file moved the answer.

**4 — Distribution.** `npm i bare` does not install a runtime. It installs a
six-line Node script that spawns a prebuilt binary from one of thirteen
per-target packages (`bare-runtime-darwin-arm64`, `-ios-arm64`,
`-android-arm64`, …), each carrying `os` and `cpu` fields so npm unpacks
exactly one. The prebuild ships non-executable; the shim `chmod`s it on first
spawn (`bare-runtime/lib/spawn.js:25-29`).

## Notes

The driver resolves the Bare shim through the `bare` package entry point rather
than `node_modules/.bin`, so the lab runs the pinned version even if npm made no
bin link and even if you have a different `bare` on your `PATH`.

## Verified against

Bare 1.31.2 source · `bare-runtime` 1.31.0 binary · darwin-arm64 · Node 22.21.0
— checked 2026-09-03.
