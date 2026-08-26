const fs = require('fs');
const rundown = JSON.parse(fs.readFileSync('public/data/daily-rundown.json', 'utf8'));

async function check() {
  for (const channel of rundown) {
    if (channel.segments && channel.segments.length > 0) {
      const seg = channel.segments[0];
      const realId = seg.identifier;
      const url = `https://archive.org/download/${realId}/${realId}.mp4?t=0/300&ignore=x.mp4`;
      
      try {
        const res = await fetch(url, { method: 'HEAD' });
        console.log(`[${channel.network}] ${realId}: Status ${res.status}, Content-Type: ${res.headers.get('content-type')}, Length: ${res.headers.get('content-length')}`);
      } catch (e) {
        console.error(`[${channel.network}] ${realId}: Error`, e.message);
      }
    }
  }
}

check();
