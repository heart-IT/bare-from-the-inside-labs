const own = require('../out/own.bare')

globalThis.peer = { name: 'carol' }
own.wrap(globalThis.peer, 'carol')

globalThis.bytes = own.lend()

own.addTeardown()

Bare.on('exit', () => own.exiting())

console.log('the script ends with carol wrapped and the lent bytes still referenced')
