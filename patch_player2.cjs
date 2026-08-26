const fs = require('fs');
let code = fs.readFileSync('src/pages/player2.tsx', 'utf8');

code = code.replace(
  `    loadPlaylist();
    interval = setInterval(loadPlaylist, 60000);
    return () => clearInterval(interval);
  }, []);`,
  `    loadPlaylist();
    intervalRef.current = setInterval(loadPlaylist, 60000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);`
);

code = code.replace(
  `  useEffect(() => {
    let interval: any;
    
    const loadPlaylist = async () => {`,
  `  const intervalRef = useRef<any>(null);
  useEffect(() => {
    const loadPlaylist = async () => {`
);

fs.writeFileSync('src/pages/player2.tsx', code);
