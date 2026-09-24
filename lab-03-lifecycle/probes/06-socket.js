// A bound UDP socket is work the loop is waiting on, so 'idle' cannot arrive
// until your code closes it. Run twice: `open` leaves the socket alone,
// `close` closes it on 'suspend' and opens a fresh one on 'resume'.
//
// on_suspend (bare/src/runtime.c:311-359) closes no handle, and bare-dgram
// subscribes to no Bare lifecycle event, so the socket's ref'd uv_udp_t keeps
// uv_run from returning. Hyperswarm's transport is also a UDP socket (udx-native,
// not bare-dgram) and leaves suspend()/resume() to the app the same way.
const dgram = require('bare-dgram')

const mode = Bare.argv.includes('close') ? 'close' : 'open'

function open (label, onready) {
  const socket = dgram.createSocket('udp4')
  socket.on('message', (msg) => {
    console.log(`${label} socket received "${msg}"`)
    onready(socket)
  })
  socket.bind(0, '127.0.0.1', () => {
    socket.send(Buffer.from('ping'), socket.address().port, '127.0.0.1')
  })
  return socket
}

open('first', (socket) => {
  Bare
    .on('suspend', () => {
      if (mode === 'close') {
        console.log('suspend — closing the socket')
        socket.close()
      } else {
        console.log('suspend — leaving the socket open')
      }
    })
    .on('idle', () => {
      console.log('idle')
      Bare.resume()
    })
    .on('resume', () => {
      console.log('resume — opening a new socket')
      open('second', (s) => s.close())
    })

  Bare.suspend()

  if (mode === 'open') {
    // Unref'd, so this timer is not itself work the loop waits on. Only the
    // socket is keeping this program out of 'idle'.
    setTimeout(() => {
      console.log('1 s later — still suspending, never idle. Leaving via Bare.exit.')
      Bare.exit(0)
    }, 1000).unref()
  }
})
