const fs = require('fs');
let code = fs.readFileSync('server/archive-routes.ts', 'utf8');

code = code.replace(
  /await db\.insert\(archiveHoldingQueue\)\.values\(\{/g,
  'await db.insert(archiveHoldingQueue).values({'
);
// I need to be more precise, let's use a regex that matches the insert up to the closing parenthesis of values() or I can just do a replace.
// Actually, I can just replace `}).catch` with `}).onConflictDoNothing().catch`? No, let's look at the context.
