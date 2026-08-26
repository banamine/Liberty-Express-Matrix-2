const fs = require('fs');
let code = fs.readFileSync('src/components/archive-shared.tsx', 'utf8');

code = code.replace(
  'import { useState, useEffect } from "react";',
  'import { useState, useEffect, useRef } from "react";'
);

code = code.replace(
  `  useEffect(() => {
    function update() {`,
  `  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    function update() {`
);

fs.writeFileSync('src/components/archive-shared.tsx', code);
