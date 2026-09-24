# lab-06-addons

Companion lab for **Bare From the Inside — Part 6: The Native Seam**.

Six probes on native addons. You compile a two-function C addon (`addon/add.c`)
the obvious way and watch the linker refuse it, then with the one flag that
leaves its engine functions for the program that loads it. You put it in a
package beside `index.js`, where `require.addon()` hands back an empty object,
and then in `prebuilds/<host>/`, where it loads. You build the same function
against Node's headers (`addon/add-napi.c`) and load one file in both Node and
Bare, rebuild `add.c` so it registers from a constructor and exports nothing,
and seal addon loading so a second addon is refused. The last probe runs
`bare-sqlite` with `bare-sqlite-vector` and takes the prebuild apart with `nm`
and `otool`.

## Run it

```sh
npm install
npm start
```

One probe at a time:

```sh
npm run probe:compile
npm run probe:find
npm run probe:napi
npm run probe:constructor
npm run probe:seal
npm run probe:sqlite
```

Needs a C compiler: on macOS, the Xcode Command Line Tools
(`xcode-select --install`), which also bring `nm` and `otool`. Probes 1–5 use
Apple clang's flags and macOS's `nm`, so they run on macOS only and print that
they were skipped anywhere else; probe 6 then prints its query, the prebuild count
and Node's `TypeError`, without the DYLD_PRINT_LIBRARIES, `nm`, `otool` and
`process.dlopen` lines. Tested on macOS (darwin-arm64) with Node.js
18.20.8, 20.19.4 and 22.21.0, which printed the same output. `npm install` is
about 110 MB, most of it the Bare binary (71 MB).

Everything the probes build goes to `out/`, which each probe recreates.

## What you will see

`bare` in the post's commands is the pinned shim, which the probes run as
`node node_modules/bare/bin/bare`: npm links no `bare` command here, because
`bare` and `bare-runtime` both declare one.

Paths are printed relative to the lab as `<lab>`. Uncaught errors are cut to
their first line: the stack below it is the loader's own frames, whose line
numbers change between Bare releases.

```
────────────────────────────────────────────────────────────────────────
  1. Compile an addon the obvious way
     cc -shared, then the flag cmake-bare adds
────────────────────────────────────────────────────────────────────────
  $ cc -shared -I node_modules/bare-headers/include -o add.bare add.c
  Undefined symbols for architecture arm64:
    _js_create_double
    _js_create_function
    _js_get_callback_info
    _js_get_value_double
    _js_set_named_property
  exit status 1

  the bare binary exports 278 js_* functions, 173 Node-API ones and 318 of libuv's

  $ cc -shared -undefined dynamic_lookup -I node_modules/bare-headers/include -o add.bare add.c
  exit status 0; add.bare exports _bare_get_module_name_v0 _bare_register_module_v0
  require('./add.bare').add(2, 3) → 5

────────────────────────────────────────────────────────────────────────
  2. Where require.addon() looks
     a package whose index.js is `module.exports = require.addon()`
────────────────────────────────────────────────────────────────────────
  add.bare beside index.js:
  exports: {}
  addon.add(2, 3) → TypeError: addon.add is not a function

  the same package, asked with the name in a variable:
  ADDON_NOT_FOUND; the first candidates:
    file://<lab>/out/find/node_modules/add/prebuilds/darwin-arm64/add@1.0.0.bare
    file://<lab>/out/find/node_modules/add/prebuilds/darwin-arm64/add@1.0.0.node
    file://<lab>/out/find/node_modules/add/prebuilds/darwin-universal/add@1.0.0.bare
    file://<lab>/out/find/node_modules/add/prebuilds/darwin-universal/add@1.0.0.node
    file://<lab>/out/find/node_modules/add/prebuilds/darwin-arm64/add.bare

  add.bare in prebuilds/darwin-arm64/:
  exports: { add: [function add] }
  addon.add(2, 3) → 5

────────────────────────────────────────────────────────────────────────
  3. An addon built for Node
     compiled against the Node-API headers, loaded by Node and by Bare
────────────────────────────────────────────────────────────────────────
  add.node exports _napi_register_module_v1 _node_api_module_get_api_version_v1
  node: require('./add.node').add(2, 3) → 5
  bare: require('./add.node').add(2, 3) → 5

────────────────────────────────────────────────────────────────────────
  4. The other door: a constructor
     the same add.c, built with BARE_MODULE_REGISTER_CONSTRUCTOR
────────────────────────────────────────────────────────────────────────
  add.bare exports nothing
  and asks the host for _bare_module_register
  require('./add.bare').add(2, 3) → 5

  one of the constructors in the bare binary itself (nm, t = local code):
    t _bare_register_module_bare_url

────────────────────────────────────────────────────────────────────────
  5. Seal addon loading
     bare-sqlite loads first; then Bare.Addon.seal(); then add
────────────────────────────────────────────────────────────────────────
  Bare.Addon.sealed → true
  bare-sqlite, loaded before the seal, queried after it → { two: 2 }
  new Bare.Addon(bare-sqlite's URL): typeof exports.open → function
  require('add') → CANNOT_LOAD: Cannot load addon 'file://<lab>/out/seal/node_modules/add/prebuilds/darwin-arm64/add.bare'
    cause: Cannot load addon '<lab>/out/seal/node_modules/add/prebuilds/darwin-arm64/add.bare' because addon loading has been sealed
  exit status 0

────────────────────────────────────────────────────────────────────────
  6. Showcase: bare-sqlite
     a query, the prebuild behind it, and the same file under Node
────────────────────────────────────────────────────────────────────────
  [ { name: 'alice', distance: 0.141421377658844 } ]
  <lab>/node_modules/bare-sqlite/prebuilds/darwin-arm64/bare-sqlite.bare
  prebuilds shipped for 13 hosts

  DYLD_PRINT_LIBRARIES, in the order the loader opened them:
    <lab>/node_modules/bare-sqlite/prebuilds/darwin-arm64/bare-sqlite.bare
    <lab>/node_modules/bare-sqlite-vector/prebuilds/darwin-arm64/bare-sqlite-vector.bare

  bare-sqlite.bare exports 283 sqlite3* symbols and bare_get_module_name_v0, bare_register_module_v0
  its install name (otool -D): bare-sqlite@0.bare
  the name it registers (strings): bare-sqlite@0.1.4
  bare-sqlite-vector.bare needs (otool -L): bare-sqlite@0.bare, /usr/lib/libSystem.B.dylib

  the same file under Node:
  TypeError: require.addon is not a function
  process.dlopen on the prebuild: Module did not self-register: '<lab>/node_modules/bare-sqlite/prebuilds/darwin-arm64/bare-sqlite.bare'.

────────────────────────────────────────────────────────────────────────
  Post: Bare From the Inside, Part 6 — The Native Seam
────────────────────────────────────────────────────────────────────────
```

## Verified against

`bare` 1.33.5 (shim) resolving `bare-runtime` 1.33.4 · `bare-headers` 1.33.2 ·
`node-api-headers` 1.9.0 · `bare-sqlite` 0.1.4 · `bare-sqlite-vector` 0.1.1 ·
Apple clang 21.0.0 — checked 2026-09-24, darwin-arm64. The exact dependency tree
is pinned by `package-lock.json`.
