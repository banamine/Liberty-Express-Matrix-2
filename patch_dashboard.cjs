const fs = require('fs');
let code = fs.readFileSync('src/pages/dashboard.tsx', 'utf8');

code = code.replace(
  'import React, { useState, useEffect } from \'react\';',
  'import React, { useState, useEffect, useRef } from \'react\';'
);

code = code.replace(
  `  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);`,
  `  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    timerRef.current = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);`
);

fs.writeFileSync('src/pages/dashboard.tsx', code);
