// The trick Shoebox runs across 164 packages, in one file.
//
// store.js requires 'fs'. This lab's package.json carries:
//
//   "imports": { "fs": { "bare": "bare-fs", "default": "fs" } }
//
// so the specifier resolves to bare-fs under Bare and to Node's own fs under
// Node. Nothing coordinates that centrally: in a real Holepunch tree, each
// package brings its own map. hypercore-storage maps fs, fs/*, os and path;
// rocksdb-native maps crypto; seventeen packages map events.
const describe = require('../store.js')

const runtime = typeof process === 'undefined' ? 'under Bare' : 'under Node'
console.log(' ', describe(), '·', runtime)

if (typeof Bare !== 'undefined') {
  const r = require.main._resolutions
  const key = Object.keys(r).find((k) => k.endsWith('/store.js'))
  const url = r[key].fs.require
  console.log('  and "fs" resolved to:', url.replace(/^file:\/\/.*\/node_modules\//, '…/node_modules/'))
}
