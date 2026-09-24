const { DatabaseSync } = require('bare-sqlite')
const vector = require('bare-sqlite-vector')

const db = new DatabaseSync(':memory:')
vector.register(db)

db.exec(`
  CREATE TABLE peers (name TEXT, position BLOB);
  INSERT INTO peers VALUES ('alice', vector_as_f32('[1, 0]')), ('bob', vector_as_f32('[0, 1]'));
`)
db.prepare("SELECT vector_init('peers', 'position', 'type=FLOAT32,dimension=2,distance=L2')").get()

const nearest = db.prepare(`
  SELECT peers.name, scan.distance
  FROM vector_full_scan('peers', 'position', vector_as_f32('[0.9, 0.1]'), 1) AS scan
  JOIN peers ON peers.rowid = scan.rowid
`)

console.log(nearest.all())
console.log(require.addon.resolve('bare-sqlite'))
