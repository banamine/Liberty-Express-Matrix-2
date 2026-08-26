const fs = require('fs');
let code = fs.readFileSync('server/archive-routes.ts', 'utf8');

code = code.replace(
  'const { identifier } = req.params;',
  `let { identifier } = req.params;
      // Normalize URL to identifier
      const archiveUrlPattern = /archive\\.org\\/(?:details|download|metadata|embed)\\/([^\\/\\?#]+)/i;
      const match = identifier.match(archiveUrlPattern);
      if (match && match[1]) {
        identifier = match[1];
      } else if (identifier.includes('://')) {
        const parts = identifier.split('/');
        identifier = parts[parts.length - 1] || identifier;
      }
      identifier = identifier.trim().replace(/\\/+$/, '');`
);

fs.writeFileSync('server/archive-routes.ts', code);
