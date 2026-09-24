// The same require written as a literal. Before any line of this file runs,
// Bare reads it, finds every name written in it, and looks each one up
// (bare-module/lib/loader.js:223-232, driving bare-module-traverse). The engines
// check throws during that lookup, so neither console.log below ever runs and
// the catch never sees the error.
console.log('  first line of 02-engines-static.js ran')

try {
  require('too-new')
} catch (e) {
  console.log('  caught', e.code)
}
