const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  '// Register API routes\n  registerRoutes(app);',
  `// Wait for DB migrations\n  const { ensureDbReady } = await import('./server/db/index.ts');\n  await ensureDbReady();\n\n  // Register API routes\n  registerRoutes(app);`
);

fs.writeFileSync('server.ts', code);
