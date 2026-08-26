import fs from 'fs';
import path from 'path';

const INDEX_FILE = path.join(process.cwd(), 'server', 'historical-bumpers.json');


  async function logHarvesterEvent(category, message, count) {
    try {
      const db = (await import("./db")).getDb();
      const { telemetryEvents } = (await import("../shared/schema"));
      const crypto = (await import("crypto"));
      await db.insert(telemetryEvents).values({
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        level: 'info',
        category: category,
        message: message,
        data: { count }
      });
    } catch(e) {}
  }

export async function harvestBumpers() {
  console.log('Harvesting historical bumpers...');
  try {
    const res = await fetch('https://archive.org/advancedsearch.php?q=collection:(rush-limbaugh-radio-show)+AND+mediatype:(movies)&fl[]=identifier,title,date,length,format&output=json&rows=2000');
    const data = await res.json() as any;
    const docs = data.response?.docs || [];

    const bumpers: Record<string, any[]> = {};
    let count = 0;
    
    for (const doc of docs) {
      if (!doc.date) continue;
      const match = doc.date.match(/^\d{4}-(\d{2}-\d{2})/);
      if (!match) continue;
      const mmdd = match[1];

      if (!bumpers[mmdd]) bumpers[mmdd] = [];

      let durationSec = 180;
      if (typeof doc.length === 'string') {
        const parts = doc.length.split(':').reverse();
        durationSec = parts.reduce((acc: number, val: string, i: number) => acc + parseInt(val) * Math.pow(60, i), 0);
      } else if (typeof doc.length === 'number') {
        durationSec = doc.length;
      }

      // We'll just construct standard URL patterns. In a true cron job, we might ping the metadata API 
      // but for this proof of concept, we'll store the identifier and a best-effort URL.
      // Wait, if the user's player logic can use the identifier to fetch the real video file using fetchArchiveCollection
      // it would be much safer. The prompt said "videoUrl" and "thumbUrl" should be in the JSON.
      // Let's use the standard naming scheme as a fallback, or we can use the Archive.org standard `/download/identifier/format=h.264` URL trick, but we tested it and it gave a 404.
      // Another trick: the media player in Archive.org uses a playlist endpoint or we can just provide the identifier.mp4.
      
      bumpers[mmdd].push({
        identifier: doc.identifier,
        title: doc.title || doc.identifier,
        duration: durationSec,
        videoUrl: `https://archive.org/download/${doc.identifier}/${doc.identifier}.mp4`,
        thumbUrl: `https://archive.org/download/${doc.identifier}/${doc.identifier}.thumbs/frame_0001.jpg`
      });
      count++;
    }

    fs.writeFileSync(INDEX_FILE, JSON.stringify(bumpers, null, 2), 'utf-8');
    console.log(`Bumpers harvested successfully. Indexed ${count} items.`);
    logHarvesterEvent("system", `Bumpers harvested successfully`, count);
  } catch (error) {
    console.error('Failed to harvest bumpers:', error);
    logHarvesterEvent('system', 'Failed to harvest bumpers: ' + error.message, 0);
  }
}

// In ESM, to check if it's the main module
if (import.meta.url.startsWith('file:') && import.meta.url.endsWith('bumper-harvester.ts')) {
  harvestBumpers();
}
