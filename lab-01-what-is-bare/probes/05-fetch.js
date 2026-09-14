// The tool you expected built in is a package you install.
//
// Probe 2 showed `typeof fetch` is undefined. Here the same question is asked
// again, then answered with two npm packages: bare-http1 serves one response on
// a local port, and bare-fetch asks for it. The client is bound to a different
// name on purpose — `const fetch = require(...)` would shadow the global and
// make the first line throw instead of printing.
console.log('typeof fetch (global)  :', typeof fetch)

const http = require('bare-http1')
const bareFetch = require('bare-fetch')

const server = http.createServer((req, res) => {
  res.end('hello from bare-http1')
})

server.listen(0, '127.0.0.1', async () => {
  const res = await bareFetch(`http://127.0.0.1:${server.address().port}/`)
  console.log('bare-fetch GET         :', res.status, await res.text())
  server.close()
  console.log('typeof fetch (global)  :', typeof fetch)

  // Opting in: bare-fetch/global assigns fetch, Request, Response and Headers
  // onto the global object. Nothing does that for you.
  require('bare-fetch/global')
  console.log('after bare-fetch/global:', typeof fetch)
  console.log('')
  console.log('Neither package is part of the runtime. Both came from node_modules,')
  console.log('pinned in package.json. Installing them added names you can require,')
  console.log('not globals; the global fetch appeared only when bare-fetch/global')
  console.log('was required.')
})
