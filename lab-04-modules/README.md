# lab-04-modules

Companion lab for **Bare From the Inside — Part 4: Every Module Is a URL**.

Six probes on how a specifier becomes a URL: what the binary carries versus
what you can require, the candidates tried behind a failed lookup and why a
literal `require` is looked up before its file runs, which condition words Bare
answers to and how two packages' key order sends them to different files, the
table of answers the loader writes and reads first, one file that runs under
both Bare and Node, and Node's own `zlib` code running unchanged on Bare through
`bare-zlib`.

## Run it

```sh
npm install
npm start
```

One probe at a time:

```sh
npm run probe:builtins
npm run probe:candidates
npm run probe:conditions
npm run probe:resolutions
npm run probe:dual
npm run probe:zlib
```

Needs Node.js 18, 20 or 22; tested on macOS with Node 18.20.8, 20.19.4 and
22.21.0, ten runs each, identical output. Probes 1–4 run under Bare; probes 5
and 6 each run the same file under both.

The six packages under `fixtures/` are hand-written, a `package.json` and a
line or two of JavaScript each, and the runner copies them into `node_modules/`
before the probes start — npm will not install them and `node_modules` is
gitignored, so that copy is what makes them exist.

## What you will see

```

────────────────────────────────────────────────────────────────────────
  1. What is in the binary, and what you can require
     two unrelated questions
────────────────────────────────────────────────────────────────────────
  bare-module    MODULE_NOT_FOUND
  bare-timers    MODULE_NOT_FOUND
  bare-inspect   MODULE_NOT_FOUND
  bare-url       RESOLVED  <- …/node_modules/bare-url/index.js
  bare-path      RESOLVED  <- …/node_modules/bare-path/index.js

  handed { timers }: require("timers") -> {"from":"the embedder"} at builtin:timers
  typeof setTimeout: function (bare-timers, and you cannot require it)

  All five are compiled in. The two that resolved came off disk,
  as dependencies of bare-runtime and bare-fs. bare-module is the
  package running the require that cannot find it. A builtin is
  whatever the program starting Bare hands in, and `bare` hands none.

────────────────────────────────────────────────────────────────────────
  2. Resolution proposes candidates
     in a fixed order, and asks about each one
────────────────────────────────────────────────────────────────────────
  MODULE_NOT_FOUND - 19 candidates, in order:
    - …/probes/missing
    - …/probes/missing.js
    - …/probes/missing.cjs
    - …/probes/missing.mjs
    - …/probes/missing.ts
    - …/probes/missing.cts
    - …/probes/missing.mts
    - …/probes/missing.json
    - …/probes/missing.bare
    - …/probes/missing.node
    - …/probes/missing/index.js
    - …/probes/missing/index.cjs
    - …/probes/missing/index.mjs
    - …/probes/missing/index.ts
    - …/probes/missing/index.cts
    - …/probes/missing/index.mts
    - …/probes/missing/index.json
    - …/probes/missing/index.bare
    - …/probes/missing/index.node

  found via extension probing
  resolved to: …/node_modules/mainless/lib/entry.js

  ADDON_NOT_FOUND - 72 addon candidates. The first eight:
    - …/node_modules/fakeaddon/prebuilds/darwin-arm64/fakeaddon@1.2.3.bare
    - …/node_modules/fakeaddon/prebuilds/darwin-arm64/fakeaddon@1.2.3.node
    - …/node_modules/fakeaddon/prebuilds/darwin-universal/fakeaddon@1.2.3.bare
    - …/node_modules/fakeaddon/prebuilds/darwin-universal/fakeaddon@1.2.3.node
    - …/node_modules/fakeaddon/prebuilds/darwin-arm64/fakeaddon.bare
    - …/node_modules/fakeaddon/prebuilds/darwin-arm64/fakeaddon.node
    - …/node_modules/fakeaddon/prebuilds/darwin-universal/fakeaddon.bare
    - …/node_modules/fakeaddon/prebuilds/darwin-universal/fakeaddon.node
    …then the same eight in every ancestor directory, up to the root,
    so this count is a fact about how deep you cloned the lab.

  UNSUPPORTED_ENGINE - caught, because this lookup ran on the line that asked

  The same require of too-new, written as a literal:
  Uncaught ModuleResolveError: UNSUPPORTED_ENGINE: Package not compatible with engine 'bare' 1.33.4, requires range '>=99.0.0' defined by "engines" in '…/node_modules/too-new/package.json'
  (exit status 134)

  Nothing here knows where a file is. It guesses in a documented
  order and asks the protocol whether each guess exists. Every name
  written in a file is looked up before the file runs, which is why
  the literal require never reached its own catch.

────────────────────────────────────────────────────────────────────────
  3. Conditions are a set; the package orders them
     same runtime, opposite answers
────────────────────────────────────────────────────────────────────────
  addon host: darwin-arm64
    bare     yes
    node     yes
    darwin   yes
    arm64    yes
    require  yes
    import   no
    linux    no
    browser  no

  cond-pkg   exports { bare, node, default } -> bare
  cond-order exports { node, bare }          -> node

  Same binary, same condition set. Only the key order differs.

  Both `bare` and `node` are always in the set. Which one wins is
  decided by the order of the keys in the package's own exports.

────────────────────────────────────────────────────────────────────────
  4. The answer is a URL, filed under who asked
     and an answer written down beats the search
────────────────────────────────────────────────────────────────────────
  after two requires, 5 referrers recorded. This file's row:
  …/04-resolutions.js
    cond-pkg  --[require]-->  …/node_modules/cond-pkg/bare.js
    mainless  --[require]-->  …/node_modules/mainless/lib/entry.js
  (the other rows are the files just loaded, each with its own answers)

  searched:       cond-pkg -> bare
  from the table: cond-pkg -> node

  That table is the contract. Walking node_modules is only how you
  fill it in when nobody already has. Handing it in is Part 5.

────────────────────────────────────────────────────────────────────────
  5. One file, two runtimes
     the trick Shoebox runs across 139 packages
────────────────────────────────────────────────────────────────────────
under Bare:
  got a filesystem · under Bare
  and "fs" resolved to: …/node_modules/bare-fs/index.js

under Node:
  got a filesystem · under Node

  store.js asks for "fs" both times. This lab's package.json maps
  that specifier under the `bare` condition and leaves `default`
  alone, so each runtime answers it with its own filesystem.

────────────────────────────────────────────────────────────────────────
  6. A Node API with a bare-* counterpart
     Node's zlib code, unchanged, on both runtimes
────────────────────────────────────────────────────────────────────────
under Bare:
  5000 bytes -> 49 bytes gzipped -> round trip ok · under Bare
  gzip bytes: H4sIAAAAAAAAE+3EIREAAAgEsCqUe/9Hf0EK3CbWZKeSJEmSJEmSPjsBIgobiBMAAA==
  and "zlib" resolved to: …/node_modules/bare-zlib/index.js
  and its C came from: …/node_modules/bare-zlib/prebuilds/darwin-arm64/bare-zlib.bare

under Node:
  5000 bytes -> 49 bytes gzipped -> round trip ok · under Node
  gzip bytes: H4sIAAAAAAAAE+3EIREAAAgEsCqUe/9Hf0EK3CbWZKeSJEmSJEmSPjsBIgobiBMAAA==

  The probe calls gzipSync and gunzipSync by Node's names. One more
  line in the imports map sends "zlib" to bare-zlib under Bare, and
  bare-zlib answers to the same names. Nothing else was ported.

────────────────────────────────────────────────────────────────────────
  Post: https://heartit.tech/bare-from-the-inside-part-4-every-module-is-a-url/
────────────────────────────────────────────────────────────────────────

```

## What each probe is for

**1 — Builtins.** All five names are compiled into the binary (`strings` on it
shows `bare-module@7.0.3`, `bare-timers@3.2.3`, `bare-inspect@3.1.10`,
`bare-url@2.5.4`, `bare-path@3.1.2`). Three cannot be required. The two that can
resolve to files under `node_modules`, where npm put them: `bare-path` as a
dependency of `bare-runtime`, `bare-url` as one of `bare-fs`'s.

`bare-module` is the sharpest case: it is the package implementing the `require`
call that cannot find it. A builtin is something the program starting Bare
hands the module system, as the loader's `builtins` option: a map from name to
exports, answered under a `builtin:` URL (`bare-module/lib/loader.js:400-420`).
The `bare` command passes none (`bare/bin/bare.js:87-98`), so every name goes to
the search. The probe hands `bare-module`'s public `createRequire` a one-entry
map to show the other side: `timers` then answers from the map, at
`builtin:timers`. `bare-timers` is the one to remember — it provides your
`setTimeout`, and you cannot import it.

**2 — Candidates.** Resolution does not know where files are. It proposes URLs
in a documented order and asks the protocol about each one; the first yes wins.
A missing relative file prints the whole list: the exact name, the name with
each of nine extensions, then the name as a directory with each `index`. That
list does not depend on where you cloned the lab. `mainless` is the same list
succeeding: its `"main"` is `lib/entry`, with no extension and no file of that
name, so the first candidate gets no and `lib/entry.js` gets yes.

Addons run the same pattern through `bare-addon-resolve`. Each directory
contributes eight candidates — `.bare` and `.node`, versioned and unversioned,
under `darwin-arm64` and `darwin-universal` — and the resolver climbs to every
ancestor's `prebuilds/` and tries the same eight, so the count is a fact about
the clone, not about Bare. Clone three directories deeper and you get
twenty-four more.

`too-new` declares `"engines": { "bare": ">=99.0.0" }`, checked against
`Bare.versions` when the package is looked up, and the check throws. When the
lookup happens depends on how the name is written. Before a file runs, Bare
reads it, finds every name written in it as a literal, and looks each one up,
then does the same for every file those lead to (the bare-module README calls
this linking; `bare-module/lib/loader.js:223-232`). So `require('too-new')`
written literally throws before the file's first line, and its `try/catch`
never runs: `02-engines-static.js` prints nothing and exits with 134. A name
held in a variable is looked up on the line that asks, where the error can be
caught. A literal name that is simply not found is recorded as unanswered and
throws `MODULE_NOT_FOUND` on its own line, so that one stays catchable.

**3 — Conditions.** Bare contributes a set: `bare`, `node`, and the platform
and arch split out of the addon host string, with the call's `require` or
`import` in front (`bare-module-traverse/lib/resolve/bare.js:10`, `:31-35`).
`cond-words` offers one subpath per word, each answering `yes` only under that
condition, so the probe reads the set back through public behaviour: `bare`,
`node`, `darwin`, `arm64` and `require` yes; `import`, `linux` and `browser` no.

Which of `bare` and `node` wins is decided by the package. `packageTarget` walks
a conditions object in key order and takes the first key that is `default` or
is in the set (`bare-module-resolve/index.js:680-704`). `cond-pkg` lists `bare`
first and gets `bare.js`; `cond-order` lists `node` first and gets `node.js`.
Same binary, same set, opposite answers — so a dependency that writes
`{ "node": …, "bare": … }` ships you its Node build under Bare, and that is
working as designed.

**4 — Resolutions.** Every answer is written into a table keyed by referrer
URL, then specifier, then the condition that produced it
(`bare-module/lib/loader.js:751-761`), and every file loaded gets a row of its
own, holding the answers found for it while it was linked (`:634`). That table
is the loader's public `resolutions` option, so the probe hands an empty object
to `createRequire` and prints what the loader wrote into it.

The same option works the other way. A table handed in is read before any
search (`bare-module-resolve/index.js:80-84`), and the loader never overwrites
an entry already there (`loader.js:758`). The probe hands in one answer the
search would never give — `cond-pkg` means `node.js` — and gets `node`. Read
the table as a specification rather than a cache: a specifier plus a referrer
plus a condition maps to exactly one URL, and walking directories is only how
you compute it when nobody already has. A bundle is the case where somebody
already has.

**5 — Dual.** `store.js` requires `fs` and never learns which runtime it is in.
This lab's `package.json` carries one map:

```json
"imports": { "fs": { "bare": "bare-fs", "default": "fs" } }
```

so the specifier resolves to `bare-fs` under Bare and Node's own `fs` under Node.
Nothing coordinates that centrally. In Shoebox's worker at `ch10-shipping` — 139 packages —
twelve distinct specifiers are mapped this way by the packages themselves:
`hypercore-storage` maps `fs`, `fs/*`, `os` and `path`; `rocksdb-native` maps
`crypto`, `fs` and `path`; twelve packages map `events`. Delete the `imports` block here and
Node keeps working while Bare gives you `MODULE_NOT_FOUND` for `fs`.

**6 — zlib.** Probe 5 showed the mechanism with `fs`; this is the same move
for the question you meet when adding a dependency: a Node API with a `bare-*`
counterpart that answers to Node's names. `06-zlib.js` calls
`zlib.gzipSync` and `zlib.gunzipSync` exactly as a Node script would. The
lab's `imports` map gains one line:

```json
"zlib": { "bare": "bare-zlib", "default": "zlib" }
```

and `bare-zlib` exports `gzipSync`, `gunzipSync`, `createGzip` and the rest
under those names (`bare-zlib/index.js:240-374`), so the code does not change.
On this machine the compressed bytes are identical under both runtimes, which
the base64 line shows; that is a measurement here, not a promise the two
libraries make. `bare-zlib` is also a native addon, and its C is the prebuild
it ships, which `require.addon.resolve` finds under its own `prebuilds/`:
the binary's compiled-in addons serve Bare's own JavaScript, and the `bare`
command hands your packages none of them. `bare-node-runtime` ships the same
mapping pre-written: its `imports.json` sends both `zlib` and `node:zlib` to
`bare-zlib` under the `bare` condition.

## Notes

The driver resolves the Bare shim through the `bare` package entry point rather
than `node_modules/.bin`, so the lab runs the pinned version even if npm made no
bin link and even if you have a different `bare` on your `PATH`.

Probe 2's addon candidate count depends on where you cloned this, and probe 3's
`darwin`/`arm64` rows on the machine. Everything else is stable.

## Verified against

Bare 1.33.5 source · `bare` 1.33.5 shim · `bare-runtime` 1.33.4 binary ·
`bare-module` 7.0.3 · `bare-module-traverse` 2.5.6 · `bare-module-resolve`
1.12.5 · `bare-addon-resolve` 1.10.1 · `bare-zlib` 1.4.1 · `bare-node-runtime`
1.5.0 (probe 6's note only) · darwin-arm64 · Node 18.20.8, 20.19.4, 22.21.0 —
checked 2026-09-24.
