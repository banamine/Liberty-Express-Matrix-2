const { PGlite } = require('@electric-sql/pglite');
async function run() {
  const db = new PGlite('./pgdata');
  await db.exec(`DELETE FROM archive_holding_queue WHERE id IN (SELECT id FROM (SELECT id, row_number() OVER (partition BY identifier, filename ORDER BY id DESC) AS rnum FROM archive_holding_queue) t WHERE t.rnum > 1);`);
  console.log("Done");
  process.exit(0);
}
run();
