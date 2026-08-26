export interface ExportEpisode {
  title: string;
  url: string;
  duration?: number;
}

export function buildWeeblyHtml(items: ExportEpisode[], title?: string): string {
  return "<html><body>Weebly Export</body></html>";
}

export function buildM3U(items: { title: string; url: string }[]): string {
  return "#EXTM3U\n" + items.map(i => `#EXTINF:-1,${i.title}\n${i.url}`).join("\n");
}
