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

if (typeof Bare !== 'undefined') {
  const r = require.main._resolutions
  const key = Object.keys(r).find((k) => k.endsWith('/06-zlib.js'))
  const url = r[key].zlib.require
  console.log('  and "zlib" resolved to:', url.replace(/^file:\/\/.*\/node_modules\//, '…/node_modules/'))
}
