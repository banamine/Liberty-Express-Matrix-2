const fs = require('fs');
let code = fs.readFileSync('server/watchdog.ts', 'utf8');

// Add isWriting flag
code = code.replace(
  'let timer: ReturnType<typeof setInterval> | null = null;',
  'let timer: ReturnType<typeof setInterval> | null = null;\nlet isWriting = false;'
);

// Update setInterval
code = code.replace(
  `  timer = setInterval(() => {
    if (!shouldStayAwake()) {`,
  `  timer = setInterval(async () => {
    if (isWriting) return;
    isWriting = true;
    try {
      if (!shouldStayAwake()) {`
);

// Add try-finally block for isWriting
code = code.replace(
  `    if (shouldStayAwake()) {
      maybeForceInject();
    }
  }, SLEEP_CHECK_INTERVAL_MS);`,
  `      if (shouldStayAwake()) {
        maybeForceInject();
      }
      
      // Heartbeat DB write check (stubbed for safety)
      const db = (await import("./db")).getDb();
      // await db.update(...) / heartbeat
      
    } finally {
      isWriting = false;
    }
  }, SLEEP_CHECK_INTERVAL_MS);`
);

fs.writeFileSync('server/watchdog.ts', code);
