const fs = require('fs');
let code = fs.readFileSync('src/pages/archive.tsx', 'utf-8');
code = code.replace(
`  const [holdingQueue, setHoldingQueue] = useState<QueueItem[]>(() => {
    try {
      const saved = localStorage.getItem('ajn-holding-queue');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('ajn-holding-queue', JSON.stringify(holdingQueue));
  }, [holdingQueue]);`,
`  const [holdingQueue, setHoldingQueue] = useState<QueueItem[]>([]);

  useEffect(() => {
    fetch('/api/archive/holding-queue')
      .then(res => res.json())
      .then(data => {
        const queueItems = data.map((item: any) => {
          let metadata = {};
          try {
             metadata = JSON.parse(item.pendingEpisodeJson || '{}');
          } catch(e){}
          return {
            id: item.identifier,
            title: metadata.title || item.identifier,
            thumbnail: item.thumbnailUrl || metadata.thumbnailUrl,
            metadata: metadata
          };
        });
        setHoldingQueue(queueItems);
      })
      .catch(console.error);
  }, []);`
);
fs.writeFileSync('src/pages/archive.tsx', code);
