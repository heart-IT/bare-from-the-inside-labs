// What require() can find, and what decides it.
//
// This file is run twice: once from the lab directory, where bare-fs is
// installed (it arrives as a dependency of bare-runtime) and bare-crypto is
// pinned in package.json, and once from an empty directory. Same binary, same
// script, different answer — so the explanation below is chosen by what
// actually resolved, not assumed.
const names = ['fs', 'node:fs', 'bare-fs', 'bare-crypto']
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

if (resolved.has('bare-crypto')) {
  // The JavaScript half came from node_modules. The C half is a native addon;
  // require.addon.resolve() asks the module system where the package's addon
  // is, and returns the file it settled on.
  const { version } = require('bare-crypto/package')
  const found = require.addon.resolve('bare-crypto')
  console.log('')
  console.log('bare-crypto has two halves. Its JavaScript came from node_modules,')
  console.log('and so does its C:')
  console.log('  ' + found)

  // The binary carries its own copy, compiled in under the exact string
  // name@version (src/addon.c:191-219). Name it and it loads.
  const builtin = 'builtin:bare-crypto@' + version
  let inBinary = true
  try {
    require.addon(builtin)
  } catch {
    inBinary = false
  }
  console.log('')
  if (inBinary) {
    console.log('The binary has its own ' + builtin.slice('builtin:'.length) + ' too — ' + builtin)
    console.log('loads when named — and the lookup above still went to disk. That')
    console.log("copy serves Bare's own bundled JavaScript; your require() is given")
    console.log('no builtins (bin/bare.js:87-99), so it looks for addons on disk.')
  } else {
    console.log('The binary has no bare-crypto@' + version + ' of its own; the lookup')
    console.log('above went to disk, as it does for every addon you install.')
  }
}
