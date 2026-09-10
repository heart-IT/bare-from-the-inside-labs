// Resolution has no idea where anything is. It proposes URLs in a fixed order
// and asks the protocol about each one; the first yes wins.
//
// The easiest way to see the list is to ask for something that cannot be found.
// fakeaddon declares "addon": true and calls require.addon(), so the addon
// resolver runs and prints every candidate it tried.
try {
  require('fakeaddon')
} catch (e) {
  const lines = e.message.split('\n')
  const candidates = lines.filter((l) => l.startsWith('- '))
  console.log(' ', e.code, '-', candidates.length, 'candidates tried, in order. The first six:')
  for (const c of candidates.slice(0, 6)) {
    console.log('   ', c.replace(/^- file:\/\/.*\/node_modules\//, '- …/node_modules/'))
  }
  console.log('    …and', candidates.length - 6, 'more.')
  console.log('')
  console.log('    Eight per directory: .bare and .node, versioned and unversioned,')
  console.log('    under darwin-arm64 and darwin-universal. Then the same eight in')
  console.log('    every ancestor prebuilds/, up to the root — so this count is a')
  console.log('    fact about how deep you cloned this lab, not about Bare.')
}

console.log('')

// Modules take the same shape. This package's "main" is "lib/entry" — no
// extension, and no file of that name. Node's ESM loader refuses an
// extensionless import; Bare probes, because one algorithm serves both formats.
console.log(' ', require('mainless'))
console.log('  resolved to:', require.resolve('mainless').replace(/^.*\/node_modules\//, '…/node_modules/'))

console.log('')

// A package.json is read for more than its exports. "engines" is checked
// against Bare.versions at resolve time, and throws.
try {
  require('too-new')
} catch (e) {
  console.log(' ', e.code, '- engines are enforced when the package is resolved, not at install time')
}
