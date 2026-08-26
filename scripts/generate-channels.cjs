const fs = require('fs');
const path = require('path');

function generateChannels() {
  let ajEpisode = {
    id: "aj-5958491114f4e4a2",
    url: "https://ajn.archives.pub/hourly-m4v/20260803_Mon_Alex-Hr1.m4v",
    fallbackUrl: "https://ajn.archives.pub/hourly-mp4/HD/Alex-Mon-Hr1.mp4",
    title: "2026-Aug-03, Monday · Alex Jones Show · Hour 1",
    timestamp: "2026-08-03T00:00:00.000Z",
    duration: 3590
  };

  try {
    const archivePath = path.join(__dirname, '../db/archives/2026-08.json');
    if (fs.existsSync(archivePath)) {
      const archiveData = JSON.parse(fs.readFileSync(archivePath, 'utf8'));
      const keys = Object.keys(archiveData);
      if (keys.length > 0) {
        const first = archiveData[keys[0]];
        if (first && first.url) {
          ajEpisode = {
            id: first.id || keys[0],
            url: first.url,
            fallbackUrl: first.url.replace('hourly-m4v', 'hourly-mp4/HD').replace('.m4v', '.mp4'),
            title: first.title || "Alex Jones Show · Hour 1",
            timestamp: first.timestamp || new Date().toISOString(),
            duration: first.duration || 3600
          };
        }
      }
    }
  } catch (e) {
    console.warn("Could not read archive for channels.json, using fallback", e.message);
  }

  let newsSegment = {
    identifier: "CNNW_20260825_210000_The_Lead_With_Jake_Tapper",
    title: "The Lead With Jake Tapper : CNNW : August 25, 2026 2:00pm-3:00pm PDT",
    duration: 3657,
    thumbBase: "https://archive.org/services/get-item-image.php?identifier=CNNW_20260825_210000_The_Lead_With_Jake_Tapper&mediatype=movies",
    addedDate: "2026-08-25T21:00:00Z"
  };

  try {
    const rundownPath = path.join(__dirname, '../public/data/daily-rundown.json');
    if (fs.existsSync(rundownPath)) {
      const rundownData = JSON.parse(fs.readFileSync(rundownPath, 'utf8'));
      if (Array.isArray(rundownData) && rundownData.length > 0) {
        const channel = rundownData.find(c => c.segments && c.segments.length > 0) || rundownData[0];
        if (channel && channel.segments && channel.segments[0]) {
          newsSegment = channel.segments[0];
        }
      }
    }
  } catch (e) {
    console.warn("Could not read daily-rundown.json for channels.json, using fallback", e.message);
  }

  const channelsManifest = {
    version: "2.0.0",
    generatedAt: new Date().toISOString(),
    channels: [
      {
        id: "player1",
        name: "AJN Playout (Player 1 / TV)",
        type: "hls",
        source: "aj-pool",
        status: "LIVE",
        streamUrl: ajEpisode.url,
        fallbackUrl: ajEpisode.fallbackUrl,
        currentProgram: {
          id: ajEpisode.id,
          title: ajEpisode.title,
          duration: ajEpisode.duration,
          timestamp: ajEpisode.timestamp
        }
      },
      {
        id: "news-player",
        name: "Global News Feed (News Player)",
        type: "archive-archive",
        source: "daily-rundown.json",
        status: "LIVE",
        streamUrl: `https://archive.org/download/${newsSegment.identifier}/${newsSegment.identifier}.mp4`,
        currentProgram: {
          identifier: newsSegment.identifier,
          title: newsSegment.title,
          duration: newsSegment.duration,
          thumbBase: newsSegment.thumbBase,
          addedDate: newsSegment.addedDate
        }
      },
      {
        id: "player2",
        name: "Live Player 2 (AJ Live / Rumble)",
        type: "embed",
        source: "manual-entry",
        status: "OFFLINE / SIGNAL PENDING",
        streamUrl: null,
        requiresManualUrl: true,
        note: "No confirmed live stream URL available right now. Requires manual URL entry."
      }
    ]
  };

  const outputPath = path.join(__dirname, '../public/channels.json');
  fs.writeFileSync(outputPath, JSON.stringify(channelsManifest, null, 2));
  
  const distDir = path.join(__dirname, '../dist');
  if (fs.existsSync(distDir)) {
    fs.writeFileSync(path.join(distDir, 'channels.json'), JSON.stringify(channelsManifest, null, 2));
  }

  console.log("✅ Generated public/channels.json successfully.");
  console.log(JSON.stringify(channelsManifest, null, 2));
}

generateChannels();
