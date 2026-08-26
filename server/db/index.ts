import { neon } from '@neondatabase/serverless';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http';
import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import * as schema from '../../shared/schema';
import fs from 'fs';
import path from 'path';

let dbInstance: any = null;
let pgliteClient: PGlite | null = null;
export let dbInitPromise: Promise<void> | null = null;

export function getDb() {
  if (!dbInstance) {
    if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgres')) {
      console.log('Using Neon Postgres');
      const sql = neon(process.env.DATABASE_URL);
      dbInstance = drizzleNeon(sql, { schema });
      
      // Auto-migrate for Neon
      try {
        const { execSync } = require('child_process');
        console.log('Pushing database schema to Neon...');
        execSync('npx drizzle-kit push --force', { encoding: 'utf-8', env: process.env });
        console.log('Database schema push complete.');
      } catch (e: any) {
        console.error('Failed to push database schema to Neon:', e.stdout || e.message);
      }
      dbInitPromise = Promise.resolve();
    } else {
      console.log('Using local PGlite fallback');
      pgliteClient = new PGlite('./pgdata');
      dbInstance = drizzlePglite(pgliteClient, { schema });
      
      // Auto-migrate (for local pglite)
      try {
        const migrationsDir = path.resolve(process.cwd(), 'migrations');
        const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
        
        dbInitPromise = (async () => {
          for (const file of files) {
            const sqlContent = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
            const statements = sqlContent.split('--> statement-breakpoint');
            
            for (const stmt of statements) {
              if (!stmt.trim()) continue;
              try {
                await pgliteClient!.exec(stmt.trim());
              } catch (e: any) {
                if (!e.message?.includes('already exists') && !e.message?.includes('duplicate column')) {
                  console.error(`Migration error in ${file}:`, e);
                }
              }
            }
          }
          try {
            await pgliteClient!.exec(`ALTER TABLE archive_holding_queue ADD COLUMN IF NOT EXISTS format varchar;`);
            await pgliteClient!.exec(`ALTER TABLE archive_holding_queue ADD COLUMN IF NOT EXISTS thumbnail_url text;`);
            await pgliteClient!.exec(`ALTER TABLE archive_holding_queue ADD COLUMN IF NOT EXISTS title text;`);
          } catch (e) {}
        })();
      } catch (e) {
        console.warn('Could not read migration files', e);
        dbInitPromise = Promise.resolve();
      }
    }
  }
  return dbInstance;
}

export async function ensureDbReady() {
  getDb();
  if (dbInitPromise) {
    await dbInitPromise;
  }
}
