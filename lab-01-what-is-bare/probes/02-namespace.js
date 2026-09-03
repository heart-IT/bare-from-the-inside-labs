// Everything Bare gives you for free. Note what is missing, and note the four
// names at the end that have no Node counterpart at all.
const names = Object.getOwnPropertyNames(Object.getPrototypeOf(Bare)).sort()
console.log('Bare namespace:', names.join(','))
console.log('')
console.log('typeof process    :', typeof process)
console.log('typeof fetch      :', typeof fetch)
console.log('typeof TextEncoder:', typeof TextEncoder)
console.log('typeof setTimeout :', typeof setTimeout, '(from bare-timers, not the runtime)')
console.log('typeof Buffer     :', typeof Buffer)
