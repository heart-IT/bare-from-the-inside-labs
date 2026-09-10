# lab-04-modules

Companion lab for **Bare From the Inside — Part 4: Every Module Is a URL**.

Five probes on how a specifier becomes a URL: what the binary carries versus
what you can require, the candidate list behind a failed lookup, two packages
whose key order sends them to different files, the resolutions table the loader
writes after every lookup, and one file that runs under both Bare and Node.

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
```

Needs Node.js 18+ on macOS or Linux. Probes 1–4 run under Bare; probe 5 runs the
same file under both.

The five packages under `fixtures/` are hand-written, two or three lines each,
and the runner copies them into `node_modules/` before the probes start — npm
will not install them and `node_modules` is gitignored, so that copy is what
makes them exist.

## What you will see

```


────────────────────────────────────────────────────────────────────────
  1. What is in the binary, and what you can require
     two unrelated questions
────────────────────────────────────────────────────────────────────────
  bare-module    MODULE_NOT_FOUND
  bare-timers    MODULE_NOT_FOUND
  bare-inspect   MODULE_NOT_FOUND
  bare-url       RESOLVED  <- /Users/f1sh/odd-jobs/heartit/bare-from-the-inside-labs/lab-04-modules/node_modules/bare-url/index.js
  bare-path      RESOLVED  <- /Users/f1sh/odd-jobs/heartit/bare-from-the-inside-labs/lab-04-modules/node_modules/bare-path/index.js

  builtinModules: []
  typeof setTimeout: function (bare-timers, and you cannot require it)

  All five are compiled in. The two that resolved came off disk,
  as transitive dependencies of bare-runtime. bare-module is the
  package running the require that cannot find it.

────────────────────────────────────────────────────────────────────────
  2. Resolution proposes candidates
     in a fixed order, and asks about each one
────────────────────────────────────────────────────────────────────────
  ADDON_NOT_FOUND - 76 candidates tried, in order. The first six:
    - …/node_modules/fakeaddon/prebuilds/darwin-arm64/fakeaddon@1.2.3.bare
    - …/node_modules/fakeaddon/prebuilds/darwin-arm64/fakeaddon@1.2.3.node
    - …/node_modules/fakeaddon/prebuilds/darwin-universal/fakeaddon@1.2.3.bare
    - …/node_modules/fakeaddon/prebuilds/darwin-universal/fakeaddon@1.2.3.node
    - …/node_modules/fakeaddon/prebuilds/darwin-arm64/fakeaddon.bare
    - …/node_modules/fakeaddon/prebuilds/darwin-arm64/fakeaddon.node
    …and 70 more.

    Eight per directory: .bare and .node, versioned and unversioned,
    under darwin-arm64 and darwin-universal. Then the same eight in
    every ancestor prebuilds/, up to the root — so this count is a
    fact about how deep you cloned this lab, not about Bare.

  found via extension probing
  resolved to: …/node_modules/mainless/lib/entry.js

  UNSUPPORTED_ENGINE - engines are enforced when the package is resolved, not at install time

  Nothing here knows where a file is. It guesses in a documented
  order and asks the protocol whether each guess exists.

────────────────────────────────────────────────────────────────────────
  3. Conditions are a set; the package orders them
     same runtime, opposite answers
────────────────────────────────────────────────────────────────────────
  conditions: ["bare","node","darwin","arm64"]
  addon host: darwin-arm64 - where the last two conditions come from

  cond-pkg   exports { bare, node, default } -> bare
  cond-order exports { node, bare }          -> node

  Same binary, same condition set. Only the key order differs.

  Both `bare` and `node` are always in the set. Which one wins is
  decided by the order of the keys in the package's own exports.

────────────────────────────────────────────────────────────────────────
  4. The answer is a URL, filed under who asked
     referrer, specifier, condition
────────────────────────────────────────────────────────────────────────
  before any require: 0 referrers recorded
  after two requires: 1 - both came from this file, so one referrer

  …/04-resolutions.js
    cond-pkg  --[require]-->  …/node_modules/cond-pkg/bare.js
    mainless  --[require]-->  …/node_modules/mainless/lib/entry.js

  That table is the contract. Walking node_modules is only how you
  fill it in when nobody already has — which is Part 5.

────────────────────────────────────────────────────────────────────────
  5. One file, two runtimes
     the trick Shoebox runs across 164 packages
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
  Post: https://heartit.tech/bare-from-the-inside-part-4-every-module-is-a-url/
────────────────────────────────────────────────────────────────────────

```

## What each probe is for

**1 — Builtins.** All five names are compiled into the binary (`strings` on it
shows `bare-module@6.4.0`, `bare-timers@3.2.3`, `bare-inspect@3.1.10`,
`bare-url@2.5.4`, `bare-path@3.1.2`). Three cannot be required. The two that can
resolve to files under `node_modules`, where npm put them as transitive
dependencies of `bare-runtime` — so when both copies exist you get the one on
disk.

`bare-module` is the sharpest case: it is the package implementing the `require`
call that cannot find it. `Module.load` does have a `builtin:` branch
(`bare-module/index.js:432`), but it reads from a `builtins` object the embedder
supplies and the `bare` CLI supplies none, which is why `builtinModules` is `[]`.
`bare-timers` is the one to remember — it provides your `setTimeout`, and you
cannot import it.

**2 — Candidates.** Resolution does not know where files are. It proposes URLs
in a documented order and asks the protocol about each one; the first yes wins.
A failed addon lookup prints the whole list.

The count is not a fact about Bare. Each directory contributes eight candidates
— `.bare` and `.node`, versioned and unversioned, under `darwin-arm64` and
`darwin-universal` — and the resolver then climbs to the parent's `prebuilds/`
and tries the same eight, up to the root. Clone this lab three directories
deeper and you get twenty-four more.

The same probe shows two other things a `package.json` decides. `mainless`
declares `"main": "lib/entry"` with no extension and no file of that name; the
resolver yields `lib/entry`, gets no, yields `lib/entry.js`, gets yes. Node's
ESM loader refuses extensionless imports — Bare runs one algorithm for both
formats. And `too-new` declares `"engines": { "bare": ">=99.0.0" }`, which is
checked against `Bare.versions` at resolve time and throws.

**3 — Conditions.** Bare contributes a set: `bare`, `node`, and the platform and
arch split out of the addon host string, with `require` or `import` prepended
per call. Both `bare` and `node` are *always* in it.

Which one wins is decided by the package. `packageTarget` walks a conditions
object in key order and takes the first key that is `default` or is in the set
(`bare-module-resolve/index.js:680-689`). `cond-pkg` lists `bare` first and gets
`bare.js`; `cond-order` lists `node` first and gets `node.js`. Same binary, same
set, opposite answers — so a dependency that writes `{ "node": …, "bare": … }`
ships you its Node build under Bare, and that is working as designed.

**4 — Resolutions.** Every successful lookup is written into a table keyed by
referrer URL, then specifier, then the condition that produced the answer
(`bare-module/index.js:735-752`). The loader reads it *first* on the next lookup,
under a comment that gives the next part away: "Don't overwrite any preexisting
entries, such as those from a bundle, as they take precedence."

Read that as a specification rather than a cache. A specifier plus a referrer
plus a condition maps to exactly one URL; walking directories is only how you
compute it when nobody already has.

**5 — Dual.** `store.js` requires `fs` and never learns which runtime it is in.
This lab's `package.json` carries one map:

```json
"imports": { "fs": { "bare": "bare-fs", "default": "fs" } }
```

so the specifier resolves to `bare-fs` under Bare and Node's own `fs` under Node.
Nothing coordinates that centrally. In Shoebox's worker tree — 164 packages —
thirteen distinct specifiers are mapped this way by the packages themselves:
`hypercore-storage` maps `fs`, `fs/*`, `os` and `path`; `rocksdb-native` maps
`crypto`; seventeen packages map `events`. Delete the `imports` block here and
Node keeps working while Bare gives you `MODULE_NOT_FOUND` for `fs`.

## Notes

The driver resolves the Bare shim through the `bare` package entry point rather
than `node_modules/.bin`, so the lab runs the pinned version even if npm made no
bin link and even if you have a different `bare` on your `PATH`.

Probe 2's candidate count and every absolute path in the output depend on where
you cloned this. Everything else is stable.

## Verified against

Bare 1.32.0 source · `bare` 1.32.0 shim · `bare-runtime` 1.32.0 binary ·
`bare-module` 6.4.0 · `bare-module-resolve` 1.12.5 · darwin-arm64 ·
Node 22.21.0 — checked 2026-09-10.
