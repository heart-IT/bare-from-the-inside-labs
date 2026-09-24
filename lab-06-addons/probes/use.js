const addon = require('add')

console.log('exports:', addon)

try {
  console.log('addon.add(2, 3) →', addon.add(2, 3))
} catch (err) {
  console.log(`addon.add(2, 3) → ${err.name}: ${err.message}`)
}
