const { drizzle } = require('drizzle-orm/pglite');
const { PGlite } = require('@electric-sql/pglite');
const schema = require('./shared/schema');
async function run() {
  const pgliteClient = new PGlite('./pgdata');
  const db = drizzle(pgliteClient, { schema });
  await db.insert(schema.archiveHoldingQueue).values({
    identifier: 'test1',
    filename: 'test.mp4',
    status: 'pending'
  }).onConflictDoNothing({ target: [schema.archiveHoldingQueue.identifier, schema.archiveHoldingQueue.filename] });
  console.log("inserted 1");
  await db.insert(schema.archiveHoldingQueue).values({
    identifier: 'test1',
    filename: 'test.mp4',
    status: 'pending'
  }).onConflictDoNothing({ target: [schema.archiveHoldingQueue.identifier, schema.archiveHoldingQueue.filename] });
  console.log("inserted 2 (no crash)");
}
run();
