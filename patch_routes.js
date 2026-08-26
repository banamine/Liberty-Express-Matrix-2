const fs = require('fs');
let code = fs.readFileSync('server/routes.ts', 'utf8');
code = code.replace(
  "  // Other endpoints like archive holding queue, watchdog, schedule, etc., will be added here\n}",
  `
  // SSE Endpoints
  app.get('/api/aj-pool/stream', (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });

    res.write(': heartbeat\\n\\n');

    const sendStatus = () => {
      res.write('event: STATUS\\n');
      res.write('data: ' + JSON.stringify({ payload: getAjStatus() }) + '\\n\\n');
    };

    sendStatus();
    const interval = setInterval(sendStatus, 5000);

    req.on('close', () => clearInterval(interval));
  });

  app.get('/api/watchdog/events', (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });

    res.write(': heartbeat\\n\\n');

    const onEvent = (event) => {
      res.write('event: ' + event.type + '\\n');
      res.write('data: ' + JSON.stringify(event) + '\\n\\n');
    };

    res.write('event: STATUS\\n');
    res.write('data: ' + JSON.stringify({ type: 'STATUS', ts: Date.now(), payload: getSystemHealth() }) + '\\n\\n');

    watchdogBus.on('watchdog', onEvent);

    req.on('close', () => watchdogBus.off('watchdog', onEvent));
  });

  // Other endpoints like archive holding queue, watchdog, schedule, etc., will be added here
}
`);
fs.writeFileSync('server/routes.ts', code);
