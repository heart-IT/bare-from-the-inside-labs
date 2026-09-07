// 'beforeExit' is not an event. It is a question the loop asks every time it
// drains: is there anything left? A listener that schedules work answers "yes"
// and gets asked again.
//
// bare_runtime_run (bare/src/runtime.c:1613-1641) emits it inside the
// do/while and then re-tests uv_loop_alive. 'exit' is emitted after the loop,
// so it fires once no matter how many times the loop went around.
let n = 0

Bare.on('beforeExit', () => {
  console.log('beforeExit', n)
  if (n++ < 2) setTimeout(() => {}, 1)
})

Bare.on('exit', () => console.log('exit'))
