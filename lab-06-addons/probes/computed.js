const name = 'add'

try {
  console.log(require.addon.resolve(name))
} catch (err) {
  console.log(err.code + '; the first candidates:')
  for (const url of err.candidates.slice(0, 5)) console.log('  ' + url.href)
}
