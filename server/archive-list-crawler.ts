import * as cheerio from 'cheerio';
import { fetchWithTimeout } from './archive-utils';

export interface ListCrawlerResult {
  identifier: string;
}

/**
 * Scrapes an Archive.org list URL (e.g. /details/@infobattalion/lists/1/documentary)
 * and extracts all item identifiers contained within it.
 */
export async function crawlArchiveList(listUrl: string): Promise<ListCrawlerResult[]> {
  try {
    const urlObj = new URL(listUrl);
    // Add ?&sort=-publicdate or just fetch the page
    const response = await fetchWithTimeout(urlObj.toString(), { timeout: 10000 });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch list URL: ${response.statusText}`);
    }
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    const identifiers = new Set<string>();
    
    // Attempt to extract from standard new UI item cells
    $('a').each((_, el) => {
      const href = $(el).attr('href');
      if (href && href.startsWith('/details/')) {
        const parts = href.split('/');
        if (parts.length === 3) {
          const identifier = parts[2];
          // Exclude URLs that are actually user profiles or other non-items
          if (!identifier.startsWith('@')) {
            identifiers.add(identifier);
          }
        }
      }
    });

    // Or from old UI items
    $('.item-ia').each((_, el) => {
      const id = $(el).attr('data-id');
      if (id) {
        identifiers.add(id);
      }
    });

    const results = Array.from(identifiers).map(id => ({ identifier: id }));
    return results;
  } catch (error) {
    console.error("crawlArchiveList error:", error);
    throw error;
  }
}
