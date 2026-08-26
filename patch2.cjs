const fs = require('fs');
let code = fs.readFileSync('src/pages/player1.tsx', 'utf8');
code = code.replace(
  'videoRef.current.play().catch(console.error);',
  'videoRef.current.play().catch(e => e.name !== "AbortError" && console.error(e));'
);
code = code.replace(
  'videoRef.current.play().catch((err) => {',
  'videoRef.current.play().catch((err) => {\n              if (err.name === "AbortError") return;'
);
fs.writeFileSync('src/pages/player1.tsx', code);
