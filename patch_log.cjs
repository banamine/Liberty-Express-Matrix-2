const fs = require('fs');
let code = fs.readFileSync('server/archive-routes.ts', 'utf8');
code = code.replace(
  'for (const item of items) {',
  'for (const item of items) { console.log("INSERTING ITEM:", item);'
);
fs.writeFileSync('server/archive-routes.ts', code);
