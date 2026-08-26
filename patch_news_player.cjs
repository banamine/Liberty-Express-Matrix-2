const fs = require('fs');
let code = fs.readFileSync('src/pages/news-player.tsx', 'utf8');

if (!code.includes('timeoutRef')) {
  code = code.replace(
    '  useEffect(() => {\n    if (status !== \'PLAYING\' && status !== \'IDLE\') {',
    '  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);\n  useEffect(() => {\n    if (status !== \'PLAYING\' && status !== \'IDLE\') {'
  );

  code = code.replace(
    `    const timeout = setTimeout(() => {
       if (videoRef.current && videoRef.current.readyState >= 3) return;
       if (hlsRef.current) {`,
    `    timeoutRef.current = setTimeout(() => {
       if (videoRef.current && videoRef.current.readyState >= 3) return;
       if (hlsRef.current) {`
  );

  code = code.replace(
    `       console.warn("Network timeout guard triggered - no playing event received in 15 seconds.");
       setPlayerKey(Date.now());
    }, 15000);
    return () => clearTimeout(timeout);
  }, [playerKey, status, segments.length]);`,
    `       console.warn("Network timeout guard triggered - no playing event received in 15 seconds.");
       setPlayerKey(Date.now());
    }, 15000);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [playerKey, status, segments.length]);`
  );
  
  fs.writeFileSync('src/pages/news-player.tsx', code);
}
