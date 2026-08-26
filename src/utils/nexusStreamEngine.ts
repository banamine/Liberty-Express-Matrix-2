export interface CleanMediaItem {
  id: string;
  cleanTitle: string;
  rawUrl: string; // NEVER mutate, decode, or regex-replace this string
}

export const processMediaFeedItem = (rawTitle: string, streamUrl: string): CleanMediaItem => {
  // Regex pipeline ONLY cleans presentation titles
  const cleanTitle = rawTitle
    .replace(/\[.*?\]|\(.*?\)/g, '')                  // Remove bracket noise
    .replace(/(1080p|720p|h264|x264|aac|mp3|mp4)/gi, '') // Remove media specs
    .replace(/[._]/g, ' ')                            // Clean underscores/dots
    .trim();

  return {
    id: crypto.randomUUID(),
    cleanTitle,
    rawUrl: streamUrl // Passed strictly untouched
  };
};
