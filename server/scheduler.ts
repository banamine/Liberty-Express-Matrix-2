import cron from 'node-cron';
import { getDb, ensureDbReady } from './db/index';
import { currentRundown } from '../shared/schema';
import { generateDailyRundown } from './news-builder';

const NETWORKS = ['BBCNEWS', 'FOXNEWSW', 'ALJAZ', 'CNNW'];

export function startScheduler() {
  console.log('Starting background scheduler for Archive.org updates...');

  // Also run once on startup to ensure fresh data
  generateDailyRundown().catch(err => console.error('Initial daily rundown generation failed:', err));

  // Run every 4 hours
  cron.schedule('0 */4 * * *', async () => {
    console.log('Running scheduled rundown update for networks:', NETWORKS);
    
    try {
      await generateDailyRundown();
    } catch (err) {
      console.error('Scheduled generateDailyRundown failed:', err);
    }

    for (const network of NETWORKS) {
      try {
        const query = encodeURIComponent(`identifier:${network}_*`);
        const url = `https://archive.org/advancedsearch.php?q=${query}&fl[]=identifier&sort[]=-addeddate&rows=3&output=json`;
        
        const response = await fetch(url);
        if (!response.ok) {
          console.error(`Failed to fetch latest broadcast for ${network}: ${response.statusText}`);
          continue;
        }

        const data = await response.json();
        const docs = data?.response?.docs;
        
        if (docs && docs.length > 0) {
          const broadcastIds = docs.map((d: any) => d.identifier);
          
          await ensureDbReady();
          const db = getDb();
          await db.insert(currentRundown)
            .values({
              network,
              broadcastIds,
              updatedAt: new Date(),
            })
            .onConflictDoUpdate({
              target: currentRundown.network,
              set: {
                broadcastIds,
                updatedAt: new Date(),
              }
            });
            
          console.log(`Updated current_rundown for ${network} -> ${broadcastIds.join(', ')}`);
        } else {
          console.log(`No broadcasts found for ${network}`);
        }
      } catch (error) {
        console.error(`Error updating rundown for ${network}:`, error);
      }
    }
    
    // DB Cleanup: Delete telemetry and news break logs older than 7 days
    try {
      const { telemetryEvents, newsBreakLog } = await import('../shared/schema');
      const { lt } = await import('drizzle-orm');
      const db = getDb();
      
      const sevenDaysAgoMs = Date.now() - (7 * 24 * 60 * 60 * 1000);
      const sevenDaysAgoDate = new Date(sevenDaysAgoMs);
      
      await db.delete(telemetryEvents).where(lt(telemetryEvents.timestamp, sevenDaysAgoMs));
      await db.delete(newsBreakLog).where(lt(newsBreakLog.firedAt, sevenDaysAgoDate));
      
      console.log('Successfully cleaned up old DB telemetry and news_break_log entries.');
    } catch (cleanupErr) {
      console.error('Failed to run DB cleanup:', cleanupErr);
    }
    
    console.log('Scheduled rundown update complete.');
  });
}
