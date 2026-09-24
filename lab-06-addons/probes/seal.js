const { DatabaseSync } = require('bare-sqlite')

Bare.Addon.seal()
console.log('Bare.Addon.sealed →', Bare.Addon.sealed)

const db = new DatabaseSync(':memory:')
console.log('bare-sqlite, loaded before the seal, queried after it →', db.prepare('SELECT 1 + 1 AS two').get())

const again = new Bare.Addon(new URL('file://' + require.addon.resolve('bare-sqlite')))
console.log("new Bare.Addon(bare-sqlite's URL): typeof exports.open →", typeof again.exports.open)

try {
  require('add')
} catch (err) {
  console.log("require('add') →", err.message.split('\n')[0])
  console.log('  cause:', err.cause.message)
}
