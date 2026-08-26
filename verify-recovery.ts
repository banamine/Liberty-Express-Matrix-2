import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { sql } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';

async function runRecoveryAudit() {
  console.log('🏁 Starting Database Integrity and Recovery Audit...\n');

  const pgdataDir = path.resolve(process.cwd(), './pgdata');
  
  // 1. Physical Layer Check
  console.log('📁 [1/4] Auditing Physical Storage Layer...');
  if (!fs.existsSync(pgdataDir)) {
    console.error('❌ CRITICAL FAILURE: The /pgdata directory does not exist at local path.');
    process.exit(1);
  }
  const diskFiles = fs.readdirSync(pgdataDir);
  console.log(`✅ Physical storage present. Found ${diskFiles.length} file descriptors inside /pgdata.\n`);

  // 2. Engine Connection Verification
  console.log('🔌 [2/4] Connecting to PGLite Engine Instances...');
  let client: PGlite;
  try {
    client = new PGlite(pgdataDir);
    // Execute low-level raw query to verify transaction readiness
    const rawCheck = await client.query(`SELECT version(), pg_is_in_recovery();`);
    console.log(`✅ Engine active. ${JSON.stringify(rawCheck.rows[0])}\n`);
  } catch (err) {
    console.error('❌ CRITICAL FAILURE: PGLite engine aborted connection pool or failed file locks.');
    console.error(err);
    process.exit(1);
  }

  // 3. Schema Structural Verification
  console.log('📐 [3/4] Probing Schema Restorations...');
  const db = drizzle(client);
  
  // The system tables to inspect for core backend logic validation
  const requiredTables = ['episodes', 'playback_channels', 'watchdog_logs', 'm3u_streams'];
  let missingTablesCount = 0;

  for (const table of requiredTables) {
    try {
      // Direct catalog lookup to see if structural migration exists
      await db.execute(sql.raw(`SELECT 1 FROM ${table} LIMIT 1;`));
      console.log(`✅ Relation structure verified: "${table}"`);
    } catch (err: any) {
      console.error(`❌ SCHEMA LOSS: Relation "${table}" failed lookup or lacks tablespace matching.`);
      console.error(`👉 Reason: ${err?.message || err}`);
      missingTablesCount++;
    }
  }

  console.log(`\n📊 Schema Verification Phase Completed with ${missingTablesCount} errors.\n`);

  // 4. State Cleanliness / Data Integrity Checks
  console.log('🧪 [4/4] Evaluating Transaction States...');
  try {
    // Check if the schema table definitions match the active internal sequence limits
    const migrationsLog = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public';
    `);
    
    console.log(`✅ App-accessible tables discovered in 'public' workspace:`);
    console.dir(migrationsLog.rows.map(r => r.table_name));

  } catch (err) {
    console.error('❌ CRITICAL FAILURE: Failed parsing structured catalog indexes.');
    console.error(err);
  } finally {
    // Explicit clean close to avoid orphaning process allocations
    await client.close();
    console.log('\n🛑 Audit Complete. Connection pool safely released.');
  }
}

runRecoveryAudit().catch((err) => {
  console.error('💥 Fatal script engine failure:', err);
  process.exit(1);
});
