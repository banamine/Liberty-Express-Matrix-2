const fs = require('fs');
let code = fs.readFileSync('src/hooks/useSystemCountdown.ts', 'utf8');

code = code.replace(
  `  useEffect(() => {
    const targetTime = new Date(endTimeStr).getTime();`,
  `  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    const targetTime = new Date(endTimeStr).getTime();`
);

fs.writeFileSync('src/hooks/useSystemCountdown.ts', code);
