// Bare contributes a set of condition strings. The package being imported
// contributes the order they are tested in — and the order is the decision.
//
// packageTarget walks a conditions object in key order and takes the first key
// that is `default` or is present in the set
// (bare-module-resolve/index.js:680-689). Both `bare` and `node` are always
// present, so whichever the package listed first wins. Bare expresses no
// preference between them; it only reports which names it answers to.
console.log('  conditions:', JSON.stringify(require.main.conditions))
console.log('  addon host:', require.addon.host, '- where the last two conditions come from')
console.log('')

// { "bare": …, "node": …, "default": … }
console.log('  cond-pkg   exports { bare, node, default } ->', require('cond-pkg'))

// { "node": …, "bare": … } - same runtime, same set, opposite answer
console.log('  cond-order exports { node, bare }          ->', require('cond-order'))
console.log('')
console.log('  Same binary, same condition set. Only the key order differs.')
