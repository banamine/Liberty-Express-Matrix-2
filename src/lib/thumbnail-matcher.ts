export interface ThumbnailMatch {
  episodeIndex: number;
  filename: string;
  thumbnailUrl: string;
}

/**
 * Parses the .thumbs/ directory HTML index and matches thumbnail frames
 * to sequential episode positions.
 */
export async function matchThumbnails(identifier: string, totalEpisodes: number): Promise<ThumbnailMatch[]> {
  const thumbsUrl = `https://archive.org/download/${identifier}/${identifier}.thumbs/`;
  const matches: ThumbnailMatch[] = [];

  try {
    const response = await fetch(thumbsUrl);
    if (!response.ok) {
      // Return empty if no .thumbs directory exists
      return [];
    }

    const html = await response.text();
    
    // We can use regex to find all .jpg files in the directory listing
    // typically looks like <a href="file_000001.jpg">
    const imgRegex = /href="([^"]+\.jpg)"/g;
    let match;
    const thumbFiles: string[] = [];

    while ((match = imgRegex.exec(html)) !== null) {
      if (!match[1].includes('?')) { // ignore query params
        thumbFiles.push(match[1]);
      }
    }

    // Sort to ensure sequential order matches typical archive patterns
    thumbFiles.sort();

    // Map the discovered thumbnails to the episodes
    // If there are exactly N episodes and N thumbnails, perfect match.
    // If more, we might just map 1:1 up to totalEpisodes
    for (let i = 0; i < Math.min(thumbFiles.length, totalEpisodes); i++) {
      matches.push({
        episodeIndex: i,
        filename: thumbFiles[i],
        thumbnailUrl: `${thumbsUrl}${thumbFiles[i]}`
      });
    }

    return matches;
  } catch (error) {
    console.error("Failed to fetch thumbs:", error);
    return [];
  }
}
