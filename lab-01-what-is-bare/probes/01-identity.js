// What is actually running? The npm package version and the binary version
// are two different numbers, and they are allowed to disagree.
console.log('Bare.version :', Bare.version)
console.log('Bare.versions:', JSON.stringify(Bare.versions))
console.log('platform/arch:', Bare.platform + '-' + Bare.arch)
