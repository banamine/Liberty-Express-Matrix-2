const fs = require('fs');
let code = fs.readFileSync('src/hooks/useStaticRundown.ts', 'utf8');

if (!code.includes('fetchRundown')) {
  // We need to wrap the fetch logic in a function and set an interval
  const fetchBody = code.match(/const primaryController = new AbortController\(\);[\s\S]*?\.finally\(\(\) => clearTimeout\(primaryTimeout\)\);/)[0];
  
  const newEffect = `  useEffect(() => {
    let isMounted = true;
    let fallbackTimeout: ReturnType<typeof setTimeout>;
    const fetchRundown = () => {
      // Memory Clearing: Explicitly nullify the old JSON payload array before the next 24-hour cycle
      setRundown([]);
      setLoading(true);

${fetchBody.split('\\n').map(l => '      ' + l.trimStart()).join('\\n')}
    };

    fetchRundown();
    
    // Fetch the next 24-hour cycle automatically
    const intervalRef = setInterval(fetchRundown, 24 * 60 * 60 * 1000);

    return () => {
      isMounted = false;
      clearInterval(intervalRef);
      setRundown([]); // cleanup on unmount
    };
  }, []);`;

  code = code.replace(/  useEffect\(\(\) => \{[\s\S]*?\}, \[\]\);/, newEffect);
  fs.writeFileSync('src/hooks/useStaticRundown.ts', code);
}
