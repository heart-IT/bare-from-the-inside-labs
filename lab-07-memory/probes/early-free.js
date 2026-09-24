const own = require('../out/early-free/own.bare')

const bytes = own.lendAndFree()
console.log('lendAndFree() →', bytes)
console.log('text(bytes) is "lent by C" →', own.text(bytes) === 'lent by C')
