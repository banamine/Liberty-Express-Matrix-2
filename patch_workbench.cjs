const fs = require('fs');
let code = fs.readFileSync('src/pages/series-workbench.tsx', 'utf8');

// Add isQueueing state
code = code.replace(
  'const [files, setFiles] = useState<SeriesFile[]>([]);',
  `const [files, setFiles] = useState<SeriesFile[]>([]);\n  const [isQueueing, setIsQueueing] = useState(false);`
);

// Update handleQueueAll
code = code.replace(
  'const handleQueueAll = async () => {\n    if (!files.length || !activeIdentifier) return;\n    try {',
  `const handleQueueAll = async () => {\n    if (!files.length || !activeIdentifier || isQueueing) return;\n    setIsQueueing(true);\n    try {`
);

// Add finally block to setIsQueueing(false)
code = code.replace(
  '      toast.success(data.message || \'Added series to holding queue\');\n      fetchQueued();\n    } catch (e: any) {\n      toast.error(e.message);\n    }\n  };',
  `      toast.success(data.message || 'Added series to holding queue');\n      fetchQueued();\n    } catch (e: any) {\n      toast.error(e.message);\n    } finally {\n      setIsQueueing(false);\n    }\n  };`
);

// Update button disabled state
code = code.replace(
  '<button onClick={handleQueueAll} className="inline-flex items-center justify-center rounded-md text-xs font-medium transition-colors bg-secondary text-secondary-foreground hover:bg-secondary/80 h-7 px-3">',
  `<button onClick={handleQueueAll} disabled={isQueueing} className="inline-flex items-center justify-center rounded-md text-xs font-medium transition-colors bg-secondary text-secondary-foreground hover:bg-secondary/80 disabled:opacity-50 h-7 px-3">`
);

fs.writeFileSync('src/pages/series-workbench.tsx', code);
