const fs = require('fs');
let code = fs.readFileSync('src/pages/series-workbench.tsx', 'utf8');

code = code.replace(
  /title: f.sanitizedTitle \|\| f.title,\n\s*thumbnailUrl: f.thumbnailUrl \|\| `https:\/\/archive\.org\/services\/img\/\$\{activeIdentifier\}`/g,
  'title: f.sanitizedTitle || f.title,\n          thumbnailUrl: f.thumbnailUrl || `https://archive.org/services/img/${activeIdentifier}`,\n          sizeMB: f.sizeMB,\n          format: f.format'
);

// also fix the queued files reading format and size from pendingEpisodeJson
code = code.replace(
  /sizeMB: item.fileSizeBytes \? \(item.fileSizeBytes \/ \(1024 \* 1024\)\) : 0,\n\s*format: 'Unknown',/g,
  'sizeMB: item.fileSizeBytes ? (item.fileSizeBytes / (1024 * 1024)) : ((() => { try { return JSON.parse(item.pendingEpisodeJson || "{}").sizeMB || 0 } catch(e) { return 0 } })()),\n                 format: (() => { try { return JSON.parse(item.pendingEpisodeJson || "{}").format || "Unknown" } catch(e) { return "Unknown" } })(),'
);

fs.writeFileSync('src/pages/series-workbench.tsx', code);
