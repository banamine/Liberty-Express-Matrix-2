const fs = require('fs');
let code = fs.readFileSync('server/archive-routes.ts', 'utf8');

code = code.replace(
  /pendingEpisodeJson: JSON.stringify\(\{ groupTitle, title: item.title, thumbnailUrl: item.thumbnailUrl \}\)/g,
  'pendingEpisodeJson: JSON.stringify({ groupTitle, title: item.title, thumbnailUrl: item.thumbnailUrl, sizeMB: item.sizeMB, format: item.format }),\n          fileSizeBytes: item.sizeMB ? Math.floor(item.sizeMB * 1024 * 1024) : 0'
);

fs.writeFileSync('server/archive-routes.ts', code);
