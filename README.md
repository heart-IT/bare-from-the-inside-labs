# Bare From the Inside — companion labs

Runnable code for the series **Bare From the Inside: the runtime under a
peer-to-peer phone app**, on [heartit.tech](https://heartit.tech).

Each directory is one part. Every claim the posts make about the runtime is
something you can run here and watch happen.

| Lab | Part | What you run |
|---|---|---|
| [`lab-01-what-is-bare`](lab-01-what-is-bare) | 1 — Why P2P Needed Its Own Runtime | Four probes: version identity, the `Bare` namespace, what `require()` can find and why, and what `npm i bare` actually installed |
| [`lab-02-loop`](lab-02-loop) | 2 — What Actually Runs | Four probes: the coarse ordering, where the microtask checkpoint falls (run under Bare *and* Node), `beforeExit` as a repeated question, and every exit path including the one that aborts |

The remaining labs land with their parts.

## Running any lab

```sh
git clone https://github.com/heart-IT/bare-from-the-inside-labs
cd bare-from-the-inside-labs/lab-01-what-is-bare
npm install
npm start
```

Node.js 18+ on macOS or Linux. Node launches things; the probes run under Bare.

Each lab pins its own dependencies, so a lab keeps producing the output its post
quotes even after the upstream packages move. The version each lab was checked
against is at the bottom of its README.

## The two Bares

The Bare you run here is not the Bare that runs inside a React Native app. These
labs use the desktop binary (1.31.x). A `react-native-bare-kit` 0.15.0 worklet
embeds **1.29.4**, because it vendors `bare-kit` 2.3.0 and that pins the older
runtime. Across that window `bare_runtime_run`, the teardown path and the
uncaught-exception and unhandled-rejection handlers are byte-identical, and so
are `bare.c`, `thread.c` and `addon.c` in full; `bare_runtime_setup` and
`bare_runtime_load` are not, and `runtime.c` grew by 146 lines.

Every post says which one it means. Labs that only hold on one side say so.

## Sources

The posts cite Holepunch source by file and line. Clone commands and pins for
every repository are in each part's References section.
