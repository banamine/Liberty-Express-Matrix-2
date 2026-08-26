import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is missing.");
}

// Initialize the Neon PostgreSQL connection using the postgres package
const sql = postgres(connectionString);
const db = drizzle(sql, { schema });

export { sql, db };
export default db;
