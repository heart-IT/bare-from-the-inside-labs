# lab-01-what-is-bare

Companion lab for **Bare From the Inside — Part 1: Why P2P Needed Its Own Runtime**.

Five probes against a real Bare binary: what version is actually running, what
the `Bare` namespace holds, what `require()` refuses to find, what
`npm i bare` put on your disk, and `fetch` arriving from two npm packages.

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
npm run probe:fetch
```

Needs Node.js 18, 20 or 22; tested on macOS with Node 18.20.8, 20.19.4 and
22.21.0. Node is only used to launch things — the probes themselves run under
Bare.

## What you will see

Paths are shortened to `<lab>` below; yours will be absolute. The exact version
numbers depend on what npm resolves for your platform.

```
────────────────────────────────────────────────────────────────────────
  1. What is actually running?
     the npm version and the binary version may differ
────────────────────────────────────────────────────────────────────────
Bare.version : v1.33.4
Bare.versions: {"bare":"1.33.4","uv":"1.52.1","v8":"14.8.178.31"}
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
bare-crypto  RESOLVED

bare-fs is right there, and `node:fs` still fails: the node: prefix
is stripped and the rest is resolved as an ordinary package name,
so require("node:fs") asks for a package called "fs". There is no
builtin table to consult. See bare-module-resolve/index.js:169-183.

bare-crypto has two halves. Its JavaScript came from node_modules,
and so does its C:
  <lab>/node_modules/bare-crypto/prebuilds/darwin-arm64/bare-crypto.bare

The binary has its own bare-crypto@1.15.3 too — builtin:bare-crypto@1.15.3
loads when named — and the lookup above still went to disk. That
copy serves Bare's own bundled JavaScript; your require() is given
no builtins (bin/bare.js:87-99), so it looks for addons on disk.

────────────────────────────────────────────────────────────────────────
  3.5. The same probe, from an empty directory
     same binary, same script, nothing on disk beside it
────────────────────────────────────────────────────────────────────────
fs           MODULE_NOT_FOUND
node:fs      MODULE_NOT_FOUND
bare-fs      MODULE_NOT_FOUND
bare-crypto  MODULE_NOT_FOUND

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
  5. The tool you expected built in
     fetch, from two npm packages: bare-fetch and bare-http1
────────────────────────────────────────────────────────────────────────
typeof fetch (global)  : undefined
bare-fetch GET         : 200 hello from bare-http1
typeof fetch (global)  : undefined
after bare-fetch/global: function

Neither package is part of the runtime. Both came from node_modules,
pinned in package.json. Installing them added names you can require,
not globals; the global fetch appeared only when bare-fetch/global
was required.

────────────────────────────────────────────────────────────────────────
  Post: https://heartit.tech/bare-from-the-inside-part-1-why-p2p-needed-its-own-runtime/
────────────────────────────────────────────────────────────────────────
```

## What each probe is for

**1 — Identity.** Two numbers that are allowed to disagree, and here do:
probe 1 prints the binary's `v1.33.4`, while `package.json` pins the `bare`
shim at 1.33.5. The
npm `bare` package is a shim; it does not pin a binary. It declares
`bare-runtime` as a peer dependency with the range `*`, so you get whichever
`bare-runtime` npm resolves — which is why this lab pins `bare-runtime`
explicitly, alongside `bare`, so the output above stays reproducible.

This lab installs `bare` 1.33.5, and `Bare.version` says `v1.33.4`: npm
has a 1.33.5 shim and no 1.33.5 `bare-runtime`, so the newest binary there is to
resolve is 1.33.4. The number that matters for behaviour is always the one the
binary reports.

**2 — Namespace.** Everything you get without installing anything. `process`,
`fetch` and `TextEncoder` are absent. `setTimeout` is present, but it comes
from the `bare-timers` package that the bootstrap installs as a global, not from
the runtime. Four names in that list — `suspend`, `idle`, `resume`, `wakeup` —
have no Node counterpart, and they are how a host puts this runtime to sleep
and wakes it. Part 3 is about them.

**3 — Resolution.** The probe runs twice, and the difference is the whole point.

From this directory, `bare-fs` resolves — it arrives as a dependency of
`bare-runtime`. And `require('node:fs')` **still fails**, with the filesystem
module sitting right there in `node_modules`. The `node:` prefix is not a
special form; it is stripped, and `fs` is resolved as an ordinary package name
(`bare-module-resolve/index.js:169-183`). There is no builtin table to consult.

`bare-crypto` resolves too, and it has two halves. Its JavaScript came from
`node_modules`, and so did its C: `require.addon.resolve('bare-crypto')` asks
the module system where that package's addon is, and gets one of the thirteen
prebuilt `.bare` files the package ships. On macOS,
`DYLD_PRINT_LIBRARIES=1 node node_modules/bare/bin/bare -e 'require("bare-crypto")' 2>&1 | grep bare-crypto.bare`
shows the process opening that same file. Launch the shim with `node` directly:
through the `#!/usr/bin/env` shebang, macOS strips `DYLD_*` variables.

The binary carries its own `bare-crypto` 1.15.3 as well, compiled in and
registered under the exact string `bare-crypto@1.15.3` (`src/addon.c:191-219`);
the probe proves it is there by loading `builtin:bare-crypto@1.15.3` by name.
The lookup still went to disk. That copy serves Bare's own bundled JavaScript,
whose addons were resolved to `builtin:` URLs when the binary was built. Your
code's `require()` is handed no builtins (`bin/bare.js:87-99`), so every
addon you install brings its own C, and deleting
`node_modules/bare-crypto/prebuilds` breaks the package instead of falling back
to the binary's copy (to put them back, `rm -rf node_modules/bare-crypto && npm
i` — a plain `npm i` sees the package as installed and leaves it alone).

Then the same file is copied into an empty temporary directory and run again.
Nothing resolves. The binary never changed. Module resolution walks up from the
file that called `require()`, so moving the file moved the answer.

**4 — Distribution.** `npm i bare` does not install a runtime. It installs a
six-line Node script that spawns a prebuilt binary from one of thirteen
per-target packages (`bare-runtime-darwin-arm64`, `-ios-arm64`,
`-android-arm64`, …), each carrying `os` and `cpu` fields so npm unpacks
exactly one. The prebuild ships non-executable; the shim `chmod`s it on first
spawn (`bare-runtime/lib/spawn.js:25-29`).

**5 — Fetch.** Probe 2 showed `typeof fetch` is `undefined`. Here it arrives
from npm: `bare-http1` serves one response on a local port and `bare-fetch`
requests it. Neither is part of the runtime, and installing them does not
create a global — the probe binds the client as `bareFetch`, because
`const fetch = require('bare-fetch')` would shadow the global and make the
first `typeof fetch` throw. The global appears only when you ask for it with
`require('bare-fetch/global')`, which assigns `fetch`, `Request`, `Response`
and `Headers` (`bare-fetch/global.js`). Underneath, `bare-http1` depends on
`bare-tcp`, a native addon with prebuilds for the same thirteen targets as the
binary.

## Notes

The driver resolves the Bare shim through the `bare` package entry point rather
than `node_modules/.bin`, so the lab runs the pinned version even if npm made no
bin link and even if you have a different `bare` on your `PATH`.

## Verified against

Bare 1.33.5 source · `bare` 1.33.5 shim · `bare-runtime` 1.33.4 binary · `bare-module-resolve` 1.12.5 · `bare-crypto` 1.15.3 · `bare-fetch` 3.4.0 · `bare-http1` 4.6.2 · darwin-arm64 · Node 18.20.8, 20.19.4, 22.21.0
— checked 2026-09-24.
