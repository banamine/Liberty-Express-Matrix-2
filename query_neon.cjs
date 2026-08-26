const { neon } = require('@neondatabase/serverless');
async function run() {
  const sql = neon(process.env.DATABASE_URL);
  const rows = await sql`SELECT * FROM telemetry_events ORDER BY timestamp DESC LIMIT 5`;
  console.log(JSON.stringify(rows, null, 2));
}
run();
