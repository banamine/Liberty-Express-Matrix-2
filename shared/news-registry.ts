export interface NewsSource {
  slug: string;
  displayName: string;
}

export const NEWS_SOURCES: NewsSource[] = [
  { slug: "cnn", displayName: "CNN" },
  { slug: "msnbc", displayName: "MSNBC" },
  { slug: "foxnews", displayName: "Fox News" },
  { slug: "bbc", displayName: "BBC News" },
  { slug: "cspan", displayName: "C-SPAN" },
  { slug: "aljazeera", displayName: "Al Jazeera" },
];

export function isNewsSource(url: string, groupTitle?: string | null, tvgLogo?: string | null): boolean {
  const combined = `${url} ${groupTitle || ""} ${tvgLogo || ""}`.toLowerCase();
  if (combined.includes("news") || combined.includes("c-span") || combined.includes("report") || combined.includes("weather") || combined.includes("fox")) {
    return true;
  }
  return false;
}
