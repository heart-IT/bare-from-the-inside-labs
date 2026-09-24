const own = require('../out/own.bare')
const collect = require('./collect')

function lendAndDrop () {
  const bytes = own.lend()
  console.log('lend() →', bytes, JSON.stringify(own.text(bytes)))
}

lendAndDrop()

collect(own, (log) => {
  console.log('after gc(): ' + log.trimEnd())

  let kept = null

  own.borrow((bytes) => {
    kept = bytes
    console.log('inside borrow():', bytes.byteLength, 'bytes,', JSON.stringify(own.text(bytes)))
  })

  console.log('after borrow() returned:', kept.byteLength, 'bytes, detached:', kept.detached)
})
