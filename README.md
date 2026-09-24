# Bare From the Inside — companion labs

Runnable code for the series **Bare From the Inside: the runtime under Pear**,
on [heartit.tech](https://heartit.tech).

Each directory is one part. Every claim the posts make about the runtime is
something you can run here and watch happen, and every lab ends with a real
`bare-*` library putting that part's idea to work.

| Lab | Part | What you run |
|---|---|---|
| [`lab-01-what-is-bare`](lab-01-what-is-bare) | 1 — Why P2P Needed Its Own Runtime | Five probes: version identity, the `Bare` namespace, what `require()` can find and why, what `npm i bare` actually installed, and `fetch` arriving as a package (bare-fetch + bare-http1) |
| [`lab-02-loop`](lab-02-loop) | 2 — What Actually Runs | Five probes: the coarse ordering, where the microtask checkpoint falls (run under Bare *and* Node), `beforeExit` as a repeated question, every exit path including the one that aborts, and the event loop's to-do list printed as a timer and a server come and go (bare-walk-handles + bare-tcp) |
| [`lab-03-lifecycle`](lab-03-lifecycle) | 3 — Suspend Is Not Pause | Six probes: suspend against a pending timer, a loop that never drains, a parked runtime freed from another thread, a wakeup deadline that closes a window without cancelling the work, one suspend cascading into a child runtime, and a UDP socket that blocks `idle` until it is closed (bare-dgram) |
| [`lab-04-modules`](lab-04-modules) | 4 — Every Module Is a URL | Six probes: what the binary carries versus what you can require, the candidate list behind a failed lookup, two packages whose key order sends them to different files, the resolutions table the loader writes, one file that runs under both Bare and Node, and Node's `zlib` code running on Bare through an `imports` map (bare-zlib) |
| [`lab-05-bundle`](lab-05-bundle) | 5 — One Bundle Per Host | Eight probes: a bundle written by hand and then misnamed, a desktop bundle's header and a byte-identical repack, embedded prebuilds failing at `dlopen`, the same prebuilds offloaded and running from a copy, a phone bundle of `linked:` names, the libraries `bare-link` makes for them, a standalone executable from `bare-build`, and a `require()` the packer cannot read (bare-pack + bare-build) |

The remaining labs land with their parts.

## Running any lab

```sh
git clone https://github.com/heart-IT/bare-from-the-inside-labs
cd bare-from-the-inside-labs/lab-01-what-is-bare
npm install
npm start
```

Labs 01–04 were tested with Node.js 18.20.8, 20.19.4 and 22.21.0, and lab 05 with 22.21.0 (its `bare-pack` crashes under 20.19.4); all on macOS. Node launches things; the probes run under Bare.

Each lab pins its own dependencies, so a lab keeps producing the output its post
quotes even after the upstream packages move. The version each lab was checked
against is at the bottom of its README.

## Which Bare

Every lab pins the npm `bare` 1.33.5 shim, which resolves the `bare-runtime`
1.33.4 binary, the version the posts are verified against. A
`react-native-bare-kit` 0.15.5 app runs the same release: it vendors `bare-kit`
2.5.4, which builds Bare 1.33.4. Hosts can still differ: a standalone executable
from `bare-build` 1.1.1 carries its own runtime, 1.33.5, which lab 05 prints next
to the 1.33.4 the `bare` command reports.

## Sources

The posts cite Holepunch source by file and line. Clone commands and pins for
every repository are in each part's References section.
