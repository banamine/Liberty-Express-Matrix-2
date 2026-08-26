import { getDb } from './server/db';
import { episodes } from './shared/schema';
import { inArray, eq } from 'drizzle-orm';
import { sanitizeTitle } from './src/lib/title-sanitizer';

export async function bulkCleanTitles(req: any, res: any) {
    try {
      const { ids, pattern, flags, replacement } = req.body;
      const db = getDb();
      const targetEpisodes = await db.select().from(episodes).where(inArray(episodes.id, ids));
      const re = new RegExp(pattern, flags);
      
      let updatedCount = 0;
      for (const ep of targetEpisodes) {
        const newTitle = ep.title.replace(re, replacement).replace(/\s{2,}/g, " ").trim();
        if (newTitle !== ep.title) {
          await db.update(episodes).set({ title: newTitle }).where(eq(episodes.id, ep.id));
          updatedCount++;
        }
      }
      res.json({ success: true, updatedCount });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
}

export async function bulkRemasterTitles(req: any, res: any) {
    try {
      const { ids, dryRun } = req.body;
      const db = getDb();
      const targetEpisodes = await db.select().from(episodes).where(inArray(episodes.id, ids));
      
      const previews: Array<{ id: string, original: string, remastered: string }> = [];
      
      for (const ep of targetEpisodes) {
        let baseName = ep.filename || ep.title;
        let cleaned = sanitizeTitle(baseName);
        
        if (/^(s\d+e\d+|\d+x\d+)$/i.test(cleaned) && ep.groupTitle) {
          cleaned = `${ep.groupTitle} ${cleaned}`;
        }
        
        if (cleaned && cleaned !== ep.title) {
          previews.push({ id: ep.id, original: ep.title, remastered: cleaned });
          if (!dryRun) {
            await db.update(episodes).set({ title: cleaned }).where(eq(episodes.id, ep.id));
          }
        }
      }
      
      res.json({ previews });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
}
