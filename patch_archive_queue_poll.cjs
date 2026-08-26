const fs = require('fs');
let code = fs.readFileSync('src/pages/archive.tsx', 'utf8');

const replacement = `
  useEffect(() => {
    let active = true;
    const fetchQueue = () => {
      fetch('/api/archive/holding-queue')
        .then(res => res.json())
        .then(data => {
          if (!active) return;
          if (data && data.items) {
            const queueItems = data.items.map((item: any) => {
              let metadata: any = {};
              try { 
                metadata = JSON.parse(item.pendingEpisodeJson || '{}');
              } catch(e){}
              return {
                id: item.identifier,
                title: metadata.title || item.identifier,
                thumbnail: item.thumbnailUrl || metadata.thumbnailUrl,
                metadata: {
                  ...metadata,
                  sizeMB: metadata.sizeMB || (item.fileSizeBytes ? item.fileSizeBytes / (1024*1024) : 0),
                  format: item.format || metadata.format
                }
              };
            });
            setHoldingQueue(queueItems);
          }
        })
        .catch(console.error);
    };

    fetchQueue();
    const interval = setInterval(fetchQueue, 3000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);
`;

code = code.replace(
  /useEffect\(\(\) => \{\s*fetch\('\/api\/archive\/holding-queue'\)[\s\S]*?\.catch\(console\.error\);\s*\}, \[\]\);/,
  replacement.trim()
);

fs.writeFileSync('src/pages/archive.tsx', code);
