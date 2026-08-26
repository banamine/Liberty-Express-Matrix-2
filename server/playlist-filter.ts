const NEWS_KEYWORDS = ['news', 'broadcast', 'live_news', 'cnn', 'bbcnews', 'foxnewsw', 'ajnews', 'msnbc'];

export function isAllowedEntertainmentChannel(groupTitle: string = "", identifier: string = ""): boolean {
  const combined = `${groupTitle} ${identifier}`.toLowerCase();
  
  // Explicitly reject any news-related categories or lists
  const isNews = NEWS_KEYWORDS.some(keyword => combined.includes(keyword));
  if (isNews) return false;

  return true; // Safe to save as TV Classics, Cartoons, Movies, etc.
}
