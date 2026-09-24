// The app every probe packs: a server and a client in one process, over
// loopback, so it needs no network and prints the same line every run.
const http = require('bare-http1')
const fetch = require('bare-fetch')

const server = http.createServer((req, res) => res.end('hello from inside a bundle'))

server.listen(0, '127.0.0.1', async () => {
  const res = await fetch(`http://127.0.0.1:${server.address().port}/`)
  console.log(res.status, await res.text(), 'on Bare', Bare.version)
  server.close()
})
