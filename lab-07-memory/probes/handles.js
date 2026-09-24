const own = require('../out/own.bare')

own.keep({ peer: 'alice' })
console.log("keep({ peer: 'alice' }), then kept() →", own.kept())

function holdPeer (count) {
  own.hold({ peer: 'bob' }, count)
}

function show (label) {
  console.log(label, own.held())
}

holdPeer(1)
gc()
show('a reference with count 1, after gc() →')

holdPeer(0)
show('a reference with count 0, before gc() →')
gc()
show('a reference with count 0, after gc() →')
