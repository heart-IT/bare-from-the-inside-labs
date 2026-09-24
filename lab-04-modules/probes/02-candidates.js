// Resolution has no idea where anything is. It proposes URLs in a fixed order
// and asks the protocol about each one; the first yes wins.
//
// The easiest way to see the list is to ask for something that is not there.
// A missing relative file prints every candidate it tried: the exact name, the
// name with each extension, then the name as a directory with an index file.
try {
  require('./missing')
} catch (e) {
  const candidates = e.message.split('\n').filter((l) => l.startsWith('- '))
  console.log(' ', e.code, '-', candidates.length, 'candidates, in order:')
  for (const c of candidates) console.log('   ', c.replace(/^- file:\/\/.*\/probes\//, '- …/probes/'))
}

console.log('')

// The same list is what finds a real file. This package's "main" is
// "lib/entry": no extension, and no file of that name. The first candidate gets
// no, the second (lib/entry.js) gets yes.
console.log(' ', require('mainless'))
console.log('  resolved to:', require.resolve('mainless').replace(/^.*\/node_modules\//, '…/node_modules/'))

console.log('')

// Addons run the same pattern through bare-addon-resolve. The name is held in a
// variable so the lookup happens on this line and lists its candidates.
const addon = 'fakeaddon'

try {
  require.addon.resolve(addon)
} catch (e) {
  const candidates = e.message.split('\n').filter((l) => l.startsWith('- '))
  console.log(' ', e.code, '-', candidates.length, 'addon candidates. The first eight:')
  for (const c of candidates.slice(0, 8)) {
    console.log('   ', c.replace(/^- file:\/\/.*\/node_modules\//, '- …/node_modules/'))
  }
  console.log('    …then the same eight in every ancestor directory, up to the root,')
  console.log('    so this count is a fact about how deep you cloned the lab.')
}

console.log('')

// "engines" is checked against Bare.versions when the package is looked up, and
// throws. Held in a variable, the lookup happens here and can be caught.
const tooNew = 'too-new'

try {
  require(tooNew)
} catch (e) {
  console.log(' ', e.code, '- caught, because this lookup ran on the line that asked')
}
