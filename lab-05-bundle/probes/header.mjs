// Reads a bundle's header without loading it: digits, then that many bytes
// of JSON, then the files. Runs under Node.
import { readFileSync } from 'node:fs'

const [file, key] = process.argv.slice(2)
const buffer = readFileSync(file)

let digits = 0
while (buffer[digits] >= 0x30 && buffer[digits] <= 0x39) digits++

const length = Number(buffer.toString('utf8', 0, digits))
const header = JSON.parse(buffer.toString('utf8', digits, digits + length))
const keys = Object.keys(header.files)

console.log(`  ${buffer.length.toLocaleString('en')} bytes: ${length.toLocaleString('en')} of header, ${(buffer.length - digits - length).toLocaleString('en')} of files`)
console.log(`  main       ${header.main}`)
console.log(`  files      ${keys.length}, of which ${keys.filter((k) => k.includes('/prebuilds/')).length} are native prebuilds`)
console.log(`  addons     ${header.addons.length}`)
for (const addon of header.addons.filter((a) => a.includes('bare-dns'))) console.log(`             ${addon}`)
if (key) {
  console.log(`  resolutions["${key}"]`)
  for (const line of JSON.stringify(header.resolutions[key], null, 2).split('\n')) console.log('    ' + line)
}
