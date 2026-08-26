import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { episodes } from './shared/schema';

async function test() {
  const client = new PGlite('./pgdata');
  const db = drizzle(client);
  
  try {
    await db.insert(episodes).values({
        id: "unique_id_" + Math.random(),
        season: 1,
        episode: 2008,
        title: "Role Models (2008)",
        duration: 0,
        url: "https://archive.org/download/duets-2000/Role%20Models%20(2008).mp4",
        groupTitle: "",
        tvgId: "duets-2000",
        tvgName: "Role Models (2008)",
        tvgLogo: "https://archive.org/services/img/duets-2000",
        objectPosition: "",
        allowedPlayers: ["player1","player2"] as any
    });
    console.log("Success");
  } catch (err: any) {
    console.error("Drizzle error:");
    console.error(err);
    if (err.cause) {
      console.error("Cause:", err.cause);
    }
  }
  process.exit(0);
}
test();
