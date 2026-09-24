// Collection is the engine's decision. gc() asks for a full collection, but a
// finalizer can run while gc() runs or just after it returns, so ask again until one reports or
// fifty tries have passed.
module.exports = function collect (own, done, tries = 0) {
  gc()
  const log = own.drain()
  if (log || tries === 50) return done(log || 'no finalizer ran\n')
  setTimeout(() => collect(own, done, tries + 1), 10)
}
