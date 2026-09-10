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
  // The JavaScript half came from node_modules. The C half is a native addon,
  // and the addon cache records where the runtime found it.
  const key = Object.keys(Bare.Addon.cache).find((k) => k.includes('bare-crypto'))
  console.log('')
  console.log('bare-crypto has two halves. Its JavaScript came from node_modules;')
  console.log('the addon cache says where the runtime found its C:')
  console.log('  ' + key)
  if (key.startsWith('builtin:')) {
    console.log('builtin: — statically linked into this binary, matched by exact')
    console.log('name@version (src/addon.c:186-214). The thirteen prebuilds under')
    console.log('node_modules/bare-crypto/prebuilds went unused; delete them and')
    console.log('this probe prints the same line.')
  } else {
    console.log('file: — the installed version is not the one linked into this')
    console.log('binary, so the runtime fell through to the prebuild on disk.')
  }
}
