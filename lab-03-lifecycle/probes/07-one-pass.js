// Requests are flags, not a queue, so several can land before the loop reads
// them. Run twice: `cancel` is Bare.suspend(); Bare.resume(), and `flick` is
// Bare.suspend(); Bare.resume(); Bare.suspend() — a background, foreground,
// background flick inside one pass.
//
// bare_runtime_suspend sets `suspend` and `resuspend`; bare_runtime_resume sets
// `resume` and clears `resuspend`. The signal handler reads them all at once
// and applies them in a fixed order (bare/src/runtime.c:590-602): suspend,
// wakeup, resume, and after the resume a second suspend if `resuspend` is
// still set. So `cancel` emits suspend then resume and never reaches idle, as
// the header promises (bare/include/bare.h:203-209), and `flick` ends
// suspending again and reaches idle once the loop is empty.
//
// The flick's idle listener resumes only so the probe ends itself; bare's own
// test/suspend-resume-suspend.js does the same.
const mode = Bare.argv.includes('flick') ? 'flick' : 'cancel'

Bare.on('suspend', () => console.log('suspend'))
Bare.on('idle', () => {
  console.log('idle — resuming so the probe ends')
  Bare.resume()
})
Bare.on('resume', () => console.log('resume'))
Bare.on('exit', () => console.log('exit'))

Bare.suspend()
Bare.resume()
if (mode === 'flick') Bare.suspend()
