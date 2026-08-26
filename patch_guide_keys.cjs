const fs = require('fs');
let code = fs.readFileSync('src/components/SlideOutGuide.tsx', 'utf8');

code = code.replace(/key=\{seg\.identifier\}/g, 'key={`${seg.identifier}-${idx}`}');

fs.writeFileSync('src/components/SlideOutGuide.tsx', code);
