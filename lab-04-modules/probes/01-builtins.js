// Being compiled into the binary and being requireable are unrelated.
//
// bare/src/builtins.json lists the native addons statically linked into the
// runtime. All five names below are in the binary you are running. Three of
// them cannot be required, and the two that can came off disk instead.
//
// Module.load does have a branch for builtin: URLs (bare-module/index.js:432),
// but it reads from a `builtins` object the embedder supplies, and the bare CLI
// supplies none. Hence builtinModules === [].
const names = ['bare-module', 'bare-timers', 'bare-inspect', 'bare-url', 'bare-path']

for (const name of names) {
  try {
    require(name)
    console.log(' ', name.padEnd(14), 'RESOLVED  <-', require.resolve(name))
  } catch (e) {
    console.log(' ', name.padEnd(14), e.code)
  }
}

console.log('')
console.log('  builtinModules:', JSON.stringify(require.main.constructor.builtinModules))
console.log('  typeof setTimeout:', typeof setTimeout, '(bare-timers, and you cannot require it)')
