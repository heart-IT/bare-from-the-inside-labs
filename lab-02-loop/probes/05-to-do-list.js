// The loop's to-do list, printed at five moments. libuv keeps a program alive
// while any handle is both active and ref'd, so those are the ones named here.
const walkHandles = require('bare-walk-handles')
const tcp = require('bare-tcp')

const names = Object.fromEntries(
  Object.entries(walkHandles.constants).map(([name, type]) => [type, name])
)

function show (moment) {
  const all = [...walkHandles()]
  const alive = all.filter((h) => h.isActive && h.hasRef).map((h) => names[h.type])
  console.log(`${moment.padEnd(17)}${String(all.length).padStart(2)} handles · keeping it alive: ${alive.join(' ')}`)
}

show('start')

const timer = setTimeout(() => {}, 1000)
show('timer set')

const server = tcp.createServer()
server.listen(0, '127.0.0.1', () => {
  show('server listening')
  clearTimeout(timer)
  show('timer cleared')
  server.close(() => {
    show('server closed')
    Bare.on('exit', () => console.log('exit'))
  })
})
