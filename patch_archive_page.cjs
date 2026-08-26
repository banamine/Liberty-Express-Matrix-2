const fs = require('fs');
let code = fs.readFileSync('src/pages/archive.tsx', 'utf8');

if (!code.includes('intervalRef')) {
  code = code.replace(
    `  useEffect(() => {
    let active = true;`,
    `  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    let active = true;`
  );
  
  code = code.replace(
    `    fetchQueue();
    const interval = setInterval(fetchQueue, 3000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);`,
    `    fetchQueue();
    intervalRef.current = setInterval(fetchQueue, 3000);
    return () => {
      active = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);`
  );
  
  fs.writeFileSync('src/pages/archive.tsx', code);
}
