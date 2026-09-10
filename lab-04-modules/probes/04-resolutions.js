// Every successful resolution is written into a table, keyed by the referrer's
// URL, then the specifier, then the condition that produced the answer
// (bare-module/index.js:735-752). The loader reads it first on the next lookup,
// under a comment that gives Part 5 away:
//
//   "Don't overwrite any preexisting entries, such as those from a bundle, as
//    they take precedence"
//
// Read it as a specification rather than a cache: a specifier plus a referrer
// plus a condition maps to exactly one URL. Walking directories is only how you
// compute that when nobody already has.
const m = require.main
const short = (s) =>
  s.includes('/node_modules/')
    ? '…/node_modules/' + s.split('/node_modules/').pop()
    : '…/' + s.split('/').pop()

const count = () => Object.keys(m._resolutions).length

console.log('  before any require:', count(), 'referrers recorded')

require('cond-pkg')
require('mainless')

console.log('  after two requires:', count(), '- both came from this file, so one referrer')
console.log('')

for (const [referrer, specifiers] of Object.entries(m._resolutions)) {
  console.log('  ' + short(referrer))
  for (const [specifier, byCondition] of Object.entries(specifiers)) {
    for (const [condition, url] of Object.entries(byCondition)) {
      console.log(`    ${specifier}  --[${condition}]-->  ${short(url)}`)
    }
  }
}
