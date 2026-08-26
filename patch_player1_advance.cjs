const fs = require('fs');
let code = fs.readFileSync('src/pages/player1.tsx', 'utf8');

if (!code.includes("Player1 segment/chunk advance")) {
  code = code.replace(
    'const handleNext = () => {',
    `const handleNext = () => {
    telemetry.info('playback', 'Player1 segment/chunk advance', { currentIndex: (currentIndex + 1) % programQueue.length });`
  );
  fs.writeFileSync('src/pages/player1.tsx', code);
}
