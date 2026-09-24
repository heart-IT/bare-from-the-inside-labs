const own = require('../out/own.bare')
const collect = require('./collect')

const peer = { name: 'alice' }
own.wrap(peer, 'alice')
console.log('unwrap(peer) →', own.unwrap(peer))
console.log('Reflect.ownKeys(peer) →', Reflect.ownKeys(peer))

try {
  own.wrap(peer, 'alice again')
} catch (err) {
  console.log('wrap(peer) again →', err.message)
}

try {
  own.unwrap(Object.create(peer))
} catch (err) {
  console.log('unwrap(Object.create(peer)) →', err.message)
}

function wrapAndDrop () {
  own.wrap({ name: 'bob' }, 'bob')
}

wrapAndDrop()

collect(own, (log) => console.log('after gc(): ' + log.trimEnd()))
