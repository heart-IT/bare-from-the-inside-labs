// This file names its dependency the way Node does, and never learns which
// runtime it is running on. The lab's package.json answers "fs" twice.
const fs = require('fs')

module.exports = function describe () {
  return typeof fs.readFileSync === 'function' ? 'got a filesystem' : 'got something else'
}
