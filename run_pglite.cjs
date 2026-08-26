const { PGlite } = require('@electric-sql/pglite');
const fs = require('fs');
async function run() {
  const db = new PGlite('./pgdata');
  const sql = fs.readFileSync('migrations/0000_tidy_nightmare.sql', 'utf8');
  for (const stmt of sql.split('--> statement-breakpoint')) {
    if (!stmt.trim()) continue;
    try {
      await db.exec(stmt.trim());
      console.log('Executed', stmt.substring(0, 30).trim());
    } catch(e) {
      console.error(e.message);
    }
  }
}
run();
