// A Node API with a bare-* counterpart: the same zlib code on both runtimes.
//
// This file requires 'zlib' and calls Node's own function names. This lab's
// package.json maps the specifier the same way it maps fs:
//
//   "zlib": { "bare": "bare-zlib", "default": "zlib" }
//
// bare-zlib exports gzipSync, gunzipSync, createGzip and the rest under Node's
// names, so the code does not change. The map is the whole port.
const zlib = require('zlib')

const text = 'peer '.repeat(1000)
const packed = zlib.gzipSync(Buffer.from(text))
const unpacked = zlib.gunzipSync(packed).toString()

const runtime = typeof process === 'undefined' ? 'under Bare' : 'under Node'
console.log(`  ${text.length} bytes -> ${packed.length} bytes gzipped -> round trip ${unpacked === text ? 'ok' : 'FAILED'} · ${runtime}`)
console.log('  gzip bytes:', packed.toString('base64'))

// bare-zlib is also a native addon. Its C is the prebuild it ships for this
// machine, found by the same kind of search under the package's prebuilds/.
if (typeof Bare !== 'undefined') {
  console.log('  and "zlib" resolved to:', require.resolve('zlib').replace(/^.*\/node_modules\//, '…/node_modules/'))
  console.log('  and its C came from:', require.addon.resolve('bare-zlib').replace(/^.*\/node_modules\//, '…/node_modules/'))
}
