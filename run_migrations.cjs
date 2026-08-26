require('dotenv').config();
const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const path = require('path');

async function run() {
  try {
    const sql = neon(process.env.DATABASE_URL);
    const files = ['0000_tidy_nightmare.sql', '0001_stale_rumiko_fujikawa.sql'];
    for (const file of files) {
      console.log(`Running ${file}...`);
      const content = fs.readFileSync(path.join(__dirname, 'migrations', file), 'utf-8');
      const statements = content.split('--> statement-breakpoint');
      for (const stmt of statements) {
        if (!stmt.trim()) continue;
        try {
          await sql(stmt.trim());
          console.log('Executed:', stmt.substring(0, 50).replace(/\n/g, ' '));
        } catch(e) {
          if (!e.message.includes('already exists') && !e.message.includes('does not exist')) {
            console.error('Error on statement:', e.message);
          }
        }
      }
    }
    console.log('Done');
  } catch(e) {
    console.error(e);
  }
}
run();
