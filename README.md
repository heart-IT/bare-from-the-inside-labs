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

Node.js 18+; tested on macOS. Node launches things; the probes run under Bare.

Each lab pins its own dependencies, so a lab keeps producing the output its post
quotes even after the upstream packages move. The version each lab was checked
against is at the bottom of its README.

## The two Bares

The Bare you run here is not the Bare that runs inside a React Native app. Every
lab pins the desktop binary at **1.32.0**, the version the posts are verified
against. A `react-native-bare-kit` 0.15.0 worklet embeds **1.29.4**, because it
vendors `bare-kit` 2.3.0 and that pins the older runtime.

Most of what these labs teach survives that gap. The lifecycle is untouched: the
state enum and every function on the suspend, idle, wakeup, resume and signal
path are byte-identical between the two tags, so lab 03 describes the phone as
accurately as the desktop. `bare_runtime_run`'s loop policy is unchanged too —
the same `do/while` with the same branches — though 1.32.0 wraps it in the addon
attach/detach pair that Part 7 is about.

One thing does not survive it, and it is in lab 02. Bare's uncaught-exception
policy grew from nine lines to thirteen in 1.32.0 (bare #184); the four new ones
are an outer `try` that keeps a throwing handler from re-entering the crash path.
Probe 4's five cases behave identically on both. A handler that *itself* throws
does not: on 1.32.0 it prints the second error and aborts with 134, and on
1.29.4 it recurses until the stack overflows and the process dies at **133 with
no output at all**. Part 12 teaches the shape that is correct on both.

Every post says which one it means. Labs that only hold on one side say so.

## Sources

The posts cite Holepunch source by file and line. Clone commands and pins for
every repository are in each part's References section.
