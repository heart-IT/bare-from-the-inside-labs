// What require() can find, and what decides it.
//
// This file is run twice: once from the lab directory, where bare-fs is
// installed (it arrives as a dependency of bare-runtime), and once from an
// empty directory. Same binary, same script, different answer — so the
// explanation below is chosen by what actually resolved, not assumed.
const names = ['fs', 'node:fs', 'bare-fs', 'bare-events']
const resolved = new Set()

for (const name of names) {
  try {
    require(name)
    resolved.add(name)
    console.log(name.padEnd(12), 'RESOLVED')
  } catch (err) {
    console.log(name.padEnd(12), err.code)
  }
}

console.log('')

if (resolved.has('bare-fs')) {
  console.log('bare-fs is right there, and `node:fs` still fails: the node: prefix')
  console.log('is stripped and the rest is resolved as an ordinary package name,')
  console.log('so require("node:fs") asks for a package called "fs". There is no')
  console.log('builtin table to consult. See bare-module-resolve/index.js:169-183.')
} else {
  console.log('Nothing resolved. Same binary, same script — the only thing that')
  console.log('changed is the directory it was run from. Resolution walks up from')
  console.log('the file that called require(), and there is no node_modules above')
  console.log('this one. The binary is not where modules come from.')
}
