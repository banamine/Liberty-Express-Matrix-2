const fs = require('fs');
const files = [
  'src/pages/tv.tsx',
  'src/pages/player2.tsx',
  'src/components/ArchiveNativePlayer.tsx'
];
files.forEach(file => {
  if (fs.existsSync(file)) {
    let code = fs.readFileSync(file, 'utf8');
    code = code.replace(
      /play\(\)\.catch\(console\.error\)/g,
      'play().catch(e => e.name !== "AbortError" && console.error(e))'
    );
    code = code.replace(
      /play\(\)\.catch\(e => console\.error\("Playback blocked", e\.message\)\)/g,
      'play().catch(e => e.name !== "AbortError" && console.error("Playback blocked", e.message))'
    );
    fs.writeFileSync(file, code);
  }
});
