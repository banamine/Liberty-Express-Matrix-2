const fs = require('fs');
let code = fs.readFileSync('src/pages/player1.tsx', 'utf8');
code = code.replace(
  'if (!videoRef.current || audioCtxRef.current) return;',
  'if (!videoRef.current || (videoRef.current as any)._audioRouted) return;\n      (videoRef.current as any)._audioRouted = true;'
);
fs.writeFileSync('src/pages/player1.tsx', code);
