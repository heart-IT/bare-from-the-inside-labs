// What require() can find, and what decides it.
//
// bare-fs is installed in this lab's node_modules (it arrives with
// bare-runtime). So the filesystem module IS here. Watch what that does, and
// does not, do for the two names Node would accept.
const names = ['fs', 'node:fs', 'bare-fs', 'bare-events']

for (const name of names) {
  try {
    require(name)
    console.log(name.padEnd(12), 'RESOLVED')
  } catch (err) {
    console.log(name.padEnd(12), err.code)
  }
}

console.log('')
console.log('bare-fs is right there, and `node:fs` still fails: the node: prefix')
console.log('is stripped and the rest is resolved as an ordinary package name,')
console.log('so require("node:fs") asks for a package called "fs". There is no')
console.log('builtin table to consult. See bare-module-resolve/index.js:169-183.')
