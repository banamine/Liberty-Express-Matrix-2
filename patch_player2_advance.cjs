const fs = require('fs');
let code = fs.readFileSync('src/pages/player2.tsx', 'utf8');

if (!code.includes("Player2 segment/chunk advance")) {
  code = code.replace(
    'const playNext = () => {',
    `const playNext = () => {
    telemetry.info('playback', 'Player2 segment/chunk advance', { currentIndex: (currentIndex + 1) % playlist.length });`
  );
  fs.writeFileSync('src/pages/player2.tsx', code);
}
