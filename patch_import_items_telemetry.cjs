const fs = require('fs');
let code = fs.readFileSync('server/archive-routes.ts', 'utf8');

// Inside app.post('/api/archive/import-items', ...
// Right before res.json({ message: "Items queued", ... })
code = code.replace(
  'res.json({ message: `${imported} items queued`, imported, skipped });',
  'logArchiveEvent("queue", `Import items queued: ${imported} imported, ${skipped} skipped for ${identifier}`, identifier);\n      res.json({ message: `${imported} items queued`, imported, skipped });'
);
fs.writeFileSync('server/archive-routes.ts', code);
