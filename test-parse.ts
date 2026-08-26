import { m3uParser } from './server/m3u-parser';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { episodes } from './shared/schema';

async function test() {
  const content = fs.readFileSync('full-test.m3u', 'utf-8');
  const res = m3uParser.parseM3UContent(content);
  
  const client = new PGlite('./pgdata');
  const db = drizzle(client);

  let importedCount = 0;
  for (const ep of res.episodes) {
    const fakeId = uuidv4();
    try {
      await db.insert(episodes).values({
          id: fakeId,
          season: ep.season,
          episode: ep.episode,
          title: ep.title,
          url: ep.url,
          duration: ep.duration,
          tvgLogo: ep.tvgLogo,
          groupTitle: ep.groupTitle,
          tvgId: ep.tvgId,
          tvgName: ep.tvgName,
          objectPosition: ep.objectPosition,
          allowedPlayers: ["player1", "player2"],
      }).onConflictDoNothing();
      importedCount++;
    } catch (e) {
      console.error("Error inserting:", ep.title, e);
    }
  }
  console.log("Imported:", importedCount);
  process.exit(0);
}
test();
