// What `npm i bare` actually put on your disk: a Node shim, and a prebuilt
// binary in a package chosen by your os and cpu.
import { readFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, dirname } from 'node:path'

const require = createRequire(import.meta.url)

const shim = join(dirname(require.resolve('bare')), 'bin', 'bare')
const source = readFileSync(shim, 'utf8')
console.log('the `bare` on your PATH is this file:')
console.log('  ' + shim)
console.log('  ' + source.trimEnd().split('\n').length + ' lines of Node:')
console.log('')
console.log(source.trimEnd().split('\n').map((l) => '    ' + l).join('\n'))
console.log('')

const binary = require('bare-runtime')()
console.log('the real binary it spawns:')
console.log('  ' + binary)
console.log('  exists:', existsSync(binary))
