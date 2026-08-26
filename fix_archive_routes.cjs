const fs = require('fs');
let code = fs.readFileSync('server/archive-routes.ts', 'utf8');

code = code.replace(/require\('\.\/db'\)/g, '(await import("./db"))');
code = code.replace(/require\('\.\.\/shared\/schema'\)/g, '(await import("../shared/schema"))');
code = code.replace(/require\('crypto'\)/g, '(await import("crypto"))');

fs.writeFileSync('server/archive-routes.ts', code);
