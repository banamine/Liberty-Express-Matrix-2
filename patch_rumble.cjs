const fs = require('fs');
let code = fs.readFileSync('server/routes.ts', 'utf8');

code = code.replace(
  'registerArchiveRoutes(app);',
  `app.get('/api/rumble-cache', (req, res) => {
    try {
      const fs = require('fs');
      if (fs.existsSync('rumble_cache.json')) {
        res.json(JSON.parse(fs.readFileSync('rumble_cache.json', 'utf8')));
      } else {
        res.json({ fallback: true, url: '' });
      }
    } catch(e) {
      res.json({ fallback: true, url: '' });
    }
  });

  registerArchiveRoutes(app);`
);

fs.writeFileSync('server/routes.ts', code);
