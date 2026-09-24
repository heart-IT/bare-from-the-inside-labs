// Being compiled into the binary and being requireable are unrelated.
//
// All five names below are in the binary you are running (`strings` on it shows
// each with its version). Three of them cannot be required, and the two that can
// came off disk instead, as transitive dependencies of bare-runtime.
//
// A builtin is something whoever starts Bare hands the module system: the
// loader's `builtins` option, a map from name to exports
// (bare-module/lib/loader.js:400-420). The `bare` command hands it none
// (bare/bin/bare.js:87-98), so every name goes to the search.
const names = ['bare-module', 'bare-timers', 'bare-inspect', 'bare-url', 'bare-path']

for (const name of names) {
  try {
    require(name)
    console.log(' ', name.padEnd(14), 'RESOLVED  <-', require.resolve(name).replace(/^.*\/node_modules\//, '…/node_modules/'))
  } catch (e) {
    console.log(' ', name.padEnd(14), e.code)
  }
}

console.log('')

// The same module system, handed a builtins map through its public
// createRequire option. require.main.constructor is a subclass of
// bare-module's Module and inherits its statics, createRequire among them.
const Module = require.main.constructor
const handed = Module.createRequire(module.url, {
  protocol: module.protocol,
  builtins: { timers: { from: 'the embedder' } }
})

console.log('  handed { timers }: require("timers") ->', JSON.stringify(handed('timers')), 'at', handed.resolve('timers'))
console.log('  typeof setTimeout:', typeof setTimeout, '(bare-timers, and you cannot require it)')
