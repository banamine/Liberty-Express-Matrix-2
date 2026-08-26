import { PGlite } from '@electric-sql/pglite';
async function test() {
  const db = new PGlite('./pgdata');
  try {
    await db.exec(`insert into "telemetry_events" ("id", "timestamp", "level", "category", "message", "data", "correlation_id") values ('70a3ed47-9e4e-4588-b95b-a5f46ce52df7', 1786875180850, 'error', 'network', 'test', '{}', null)`);
    console.log("Success");
  } catch (e) {
    console.error(e);
  }
  db.close();
}
test();
