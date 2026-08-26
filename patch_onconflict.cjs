const fs = require('fs');
let code = fs.readFileSync('server/archive-routes.ts', 'utf-8');

code = code.replace(
  /\.onConflictDoNothing\(\);/g,
  '.onConflictDoNothing({ target: [archiveHoldingQueue.identifier, archiveHoldingQueue.filename] });'
);
// But wait, line 294 is for `episodes` table: `await db.insert(episodes).values({...}).onConflictDoNothing();`
// We shouldn't replace all!
