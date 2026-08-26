const fs = require('fs');
let code = fs.readFileSync('server/routes.ts', 'utf8');

code = code.replace(/require\('\.\/db'\)/g, 'await import("./db")');
code = code.replace(/require\('\.\.\/shared\/schema'\)/g, 'await import("../shared/schema")');
code = code.replace(/require\('crypto'\)/g, 'await import("crypto")');
code = code.replace(/require\('drizzle-orm'\)/g, 'await import("drizzle-orm")');

fs.writeFileSync('server/routes.ts', code);
