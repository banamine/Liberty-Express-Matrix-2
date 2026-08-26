const fs = require('fs');
let code = fs.readFileSync('server/routes.ts', 'utf8');

code = code.replace("res.on('finish', () => {", "res.on('finish', async () => {");
// also fix getDb()
code = code.replace('await import("./db").getDb()', '(await import("./db")).getDb()');

fs.writeFileSync('server/routes.ts', code);
