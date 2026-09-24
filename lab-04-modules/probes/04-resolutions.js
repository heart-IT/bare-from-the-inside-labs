// Every answer is written down, keyed by the referrer's URL, then the
// specifier, then the condition that produced it
// (bare-module/lib/loader.js:751-761). The loader's `resolutions` option is that
// table, and a table handed in is read before any search
// (bare-module-resolve/index.js:80-84) and never overwritten (loader.js:758).
//
// Both halves below use bare-module's public createRequire. The first hands it
// an empty object and reads back what it wrote. The second hands it an answer
// the search would never have given.
const Module = require.main.constructor
const protocol = module.protocol
const short = (s) =>
  s.includes('/node_modules/')
    ? '…/node_modules/' + s.split('/node_modules/').pop()
    : '…/' + s.split('/').pop()

const answers = {}
const ask = Module.createRequire(module.url, { protocol, resolutions: answers })

ask('cond-pkg')
ask('mainless')

console.log('  after two requires,', Object.keys(answers).length, 'referrers recorded. This file\'s row:')
console.log('  ' + short(module.url.href))
for (const [specifier, byCondition] of Object.entries(answers[module.url.href])) {
  for (const [condition, url] of Object.entries(byCondition)) {
    console.log(`    ${specifier}  --[${condition}]-->  ${short(url)}`)
  }
}
console.log('  (the other rows are the files just loaded, each with its own answers)')

console.log('')

const nodeBuild = new URL('../node_modules/cond-pkg/node.js', module.url).href
const told = Module.createRequire(module.url, {
  protocol,
  resolutions: { [module.url.href]: { 'cond-pkg': { require: nodeBuild } } }
})

console.log('  searched:       cond-pkg ->', ask('cond-pkg'))
console.log('  from the table: cond-pkg ->', told('cond-pkg'))
