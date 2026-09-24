// Bare contributes a set of condition words. The package being imported
// contributes the order they are tested in, and the order is the decision.
//
// cond-words offers one subpath per word, each shaped
//   "./<word>": { "<word>": "./yes.js", "default": "./no.js" }
// so asking for a subpath answers whether Bare is in that condition.
// The set is ['bare', 'node', ...Bare.Addon.host.split('-')] with the call's
// own `require` or `import` in front (bare-module-traverse/lib/resolve/bare.js:10,
// :31-35).
console.log('  addon host:', require.addon.host)

for (const word of ['bare', 'node', 'darwin', 'arm64', 'require', 'import', 'linux', 'browser']) {
  console.log('   ', word.padEnd(8), require('cond-words/' + word))
}

console.log('')

// packageTarget walks a conditions object in key order and takes the first key
// that is `default` or is in the set (bare-module-resolve/index.js:680-704).
// Both `bare` and `node` are in the set, so whichever the package listed first
// wins.

// { "bare": …, "node": …, "default": … }
console.log('  cond-pkg   exports { bare, node, default } ->', require('cond-pkg'))

// { "node": …, "bare": … } - same runtime, same set, opposite answer
console.log('  cond-order exports { node, bare }          ->', require('cond-order'))
console.log('')
console.log('  Same binary, same condition set. Only the key order differs.')
