const fs = require('fs');
let code = fs.readFileSync('src/components/archive-shared.tsx', 'utf8');

if (!code.includes('intervalRef')) {
  code = code.replace(
    'import React, { useState, useEffect } from "react";',
    'import React, { useState, useEffect, useRef } from "react";'
  );
  
  code = code.replace(
    `  useEffect(() => {
    const update = () => {`,
    `  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    const update = () => {`
  );
  
  code = code.replace(
    `    }
    update();
    const t = setInterval(update, 60_000);
    return () => clearInterval(t);
  }, [date]);`,
    `    }
    update();
    intervalRef.current = setInterval(update, 60_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [date]);`
  );
  
  fs.writeFileSync('src/components/archive-shared.tsx', code);
}
