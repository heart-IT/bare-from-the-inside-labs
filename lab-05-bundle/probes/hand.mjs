// Writes a bundle by hand: a length, a JSON header, then the files' bytes.
// Runs under Node; the driver runs the result under Bare.
import { writeFileSync } from 'node:fs'

const files = {
  '/app/index.js': "const m = require('./lib/m')\nconsole.log(m, 'at', __filename)\n",
  '/app/lib/m.js': "module.exports = 'hello from a hand-made bundle'\n"
}
const keys = Object.keys(files).sort()
const header = { version: 0, id: null, main: '/app/index.js', imports: {},
  resolutions: { '/app/index.js': { './lib/m': '/app/lib/m.js' } },
  addons: [], assets: [], files: {} }
let offset = 0
for (const key of keys) {
  const length = Buffer.byteLength(files[key])
  header.files[key] = { offset, length, mode: 0o644 }
  offset += length
}
const json = `\n${JSON.stringify(header)}\n`
writeFileSync(process.argv[2], Buffer.concat([
  Buffer.from(String(Buffer.byteLength(json))), Buffer.from(json),
  ...keys.map((key) => Buffer.from(files[key]))]))
