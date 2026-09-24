# lab-05-bundle

Companion lab for **Bare From the Inside — Part 5: One Bundle Per Host**.

Eight probes, most of which pack the same small app (`app.js`: a `bare-http1`
server and a `bare-fetch` client talking over loopback) in different ways. You
write a bundle by hand and run it, then run the same bytes as a `.js` file and
watch it fail. You pack the app for this machine, read the header without
running it, and pack it again to get the same bytes. You see its embedded
prebuilds fail to load, and offload them so it runs. You pack it for phones and
see names where the native code was, make the libraries those names point at
with `bare-link`, and build one standalone executable with `bare-build`. The
last probe packs a `require()` whose name is in a variable, which works inside
the lab and fails from an empty folder.

## Run it

```sh
npm install
npm start
```

One probe at a time:

```sh
npm run probe:hand
npm run probe:pack
npm run probe:embedded
npm run probe:offload
npm run probe:mobile
npm run probe:link
npm run probe:standalone
npm run probe:dynamic
```

Needs Node.js 22; tested with 22.21.0 on macOS. Under Node 20.19.4, `bare-pack`
crashes with exit status 139 before writing a bundle.

`npm install` is about 240 MB. The largest pieces are the Bare binary for your
machine (71 MB), `bare-lief`, which `bare-link` edits libraries with (71 MB), and
`bare-tls` (52 MB), which ships prebuilds for every host. Probe 7
needs `bare-build`, which installs a Bare executable for all 13 hosts it can
target, about 1 GB, so it lives in `standalone/` and `npm start` skips the probe
until it is installed. `npm run probe:standalone` installs it and runs the probe;
the transcript below includes it.

Everything the probes keep goes to `out/`; probes 3, 4 and 8 also copy files
into a temporary folder they delete afterwards. Probe 7's executable also unpacks
its addons into your temporary directory the first time it starts; delete
`$TMPDIR/lab-05-bundle-*` to clean up.

## What you will see

`bare` in the post's commands is the pinned shim, which the probes run as
`node node_modules/bare/bin/bare`: npm links no `bare` command here, because
`bare` and `bare-runtime` both declare one. "Somewhere else" in probes 3, 4
and 8 is a new folder under your temp directory, printed as `<elsewhere>`.

Paths are printed relative to the lab as `<lab>`. Uncaught errors are cut to
their first line: the stack below it is the loader's own frames, whose line
numbers change between Bare releases.

```
────────────────────────────────────────────────────────────────────────
  1. A bundle by hand
     a length, a JSON header, then the files
────────────────────────────────────────────────────────────────────────
  first bytes: "260\n{\"version\":0,\"id\":null,\"main\":\"/app/index.js"
  hello from a hand-made bundle at <lab>/out/hand/hand.bundle/app/index.js

  the same bytes, saved as hand.js:
  Uncaught SyntaxError: Unexpected token ':'
  exit status 134

────────────────────────────────────────────────────────────────────────
  2. Pack app.js for this machine (darwin-arm64)
     and read the header without running it
────────────────────────────────────────────────────────────────────────
    4,621,813 bytes: 37,899 of header, 4,583,909 of files
    main       /app.js
    files      144, of which 10 are native prebuilds
    addons     10
               /node_modules/bare-dns/prebuilds/darwin-arm64/bare-dns.bare
    resolutions["/node_modules/bare-dns/binding.js"]
      {
        "#package": "/node_modules/bare-dns/package.json",
        ".": "/node_modules/bare-dns/prebuilds/darwin-arm64/bare-dns.bare"
      }

  packed again: byte-identical

────────────────────────────────────────────────────────────────────────
  3. Run it from somewhere else
     the prebuilds are inside the bundle
────────────────────────────────────────────────────────────────────────
  Uncaught AddonError: CANNOT_LOAD: Cannot load addon 'file://<elsewhere>/app.bundle/node_modules/bare-dns/prebuilds/darwin-arm64/bare-dns.bare'
  exit status 134
  cause: Error: dlopen…
  errno=20: the path runs through app.bundle, which is a file, not a directory

────────────────────────────────────────────────────────────────────────
  4. Offload the addons
     bundle plus real files beside it, copied anywhere
────────────────────────────────────────────────────────────────────────
  wrote 11 files: app.bundle and 10 .bare prebuilds beside it
  200 hello from inside a bundle on Bare v1.33.4

────────────────────────────────────────────────────────────────────────
  5. Pack for phones
     --preset mobile: names instead of native bytes
────────────────────────────────────────────────────────────────────────
    544,453 bytes: 36,131 of header, 508,317 of files
    main       /app.js
    files      134, of which 0 are native prebuilds
    addons     20
               linked:bare-dns.2.2.1.framework/bare-dns.2.2.1
               linked:libbare-dns.2.2.1.so
    resolutions["/node_modules/bare-dns/binding.js"]
      {
        "#package": "/node_modules/bare-dns/package.json",
        ".": {
          "android": "linked:libbare-dns.2.2.1.so",
          "ios": "linked:bare-dns.2.2.1.framework/bare-dns.2.2.1"
        }
      }

  the phone bundle, run on this darwin-arm64 machine:
  Uncaught ModuleError: ADDON_NOT_FOUND: Cannot find addon '.' imported from 'file://<lab>/out/mobile/app.bundle/node_modules/bare-dns/binding.js'
  exit status 134

────────────────────────────────────────────────────────────────────────
  6. Make the libraries those names point at
     bare-link, for one Android and one iOS host
────────────────────────────────────────────────────────────────────────
  10 Android libraries in arm64-v8a/, 10 iOS frameworks
    arm64-v8a/libbare-dns.2.2.1.so
    bare-dns.2.2.1.framework/bare-dns.2.2.1

  linked: names in the phone bundle: 20; missing from bare-link's output: 0
  made but never named by the bundle: 0

────────────────────────────────────────────────────────────────────────
  7. One executable, no node_modules
     bare-build --standalone
────────────────────────────────────────────────────────────────────────
  <lab>/out/standalone/lab-05-bundle: 71,779,888 bytes
  the bundle rides in section __BARE,__bundle: 4,779,575 bytes
  run from / :
  200 hello from inside a bundle on Bare v1.33.5
  $TMPDIR/lab-05-bundle-24bf6c984aba…/  10 .bare files, written on first start

────────────────────────────────────────────────────────────────────────
  8. A specifier the packer cannot read
     require(name), with name in a variable
────────────────────────────────────────────────────────────────────────
  inside the lab, with the lab's node_modules two folders up:
  function
  exit status 0

  copied to an empty folder:
  Uncaught ModuleError: MODULE_NOT_FOUND: Cannot find module 'bare-fetch' imported from 'file://<elsewhere>/dyn.bundle/probes/dyn.js'
  exit status 134

────────────────────────────────────────────────────────────────────────
  Post: Bare From the Inside, Part 5 — One Bundle Per Host
────────────────────────────────────────────────────────────────────────
```

## Verified against

`bare` 1.33.5 (shim) resolving `bare-runtime` 1.33.4 · `bare-pack` 2.2.2 ·
`bare-link` 3.3.0 · `bare-build` 1.1.1 · `bare-fetch` 3.4.0 · `bare-http1` 4.6.2
— checked 2026-09-24, darwin-arm64. The byte counts depend on the exact dependency
tree, which `package-lock.json` pins.
