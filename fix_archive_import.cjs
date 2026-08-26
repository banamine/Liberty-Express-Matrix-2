const fs = require('fs');
let code = fs.readFileSync('src/pages/archive.tsx', 'utf8');

code = code.replace(
  'import { useState, useEffect } from \'react\';',
  'import { useState, useEffect, useRef } from \'react\';'
);

fs.writeFileSync('src/pages/archive.tsx', code);
