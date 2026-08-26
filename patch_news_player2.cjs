const fs = require('fs');
let code = fs.readFileSync('src/pages/news-player.tsx', 'utf8');

code = code.replace(
  'const timeout = setTimeout(() => {',
  'timeoutRef.current = setTimeout(() => {'
);

fs.writeFileSync('src/pages/news-player.tsx', code);
