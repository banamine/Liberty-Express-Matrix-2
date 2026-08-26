export interface ParsedArchiveStream {
  serverHost: string;
  serverPathPrefix: string;
  identifier: string;
  fileSlug: string;
  start: number;
  end: number;
}

export function parseArchiveUrl(url: string): ParsedArchiveStream | null {
  try {
    let identifier = "";
    let serverHost = "archive.org";
    let serverPathPrefix = "/download";
    let fileSlug = "";
    let start: number = 0;
    let end: number = 0;

    if (!url.includes('/')) {
      identifier = url;
      fileSlug = `${identifier}.mp4`;
    } else {
      const parsedUrl = new URL(url);
      serverHost = parsedUrl.hostname;

      // Check for /details/IDENTIFIER or /download/IDENTIFIER
      let match = url.match(/\/(?:details|download)\/([^/?#]+)/);
      if (match) {
        identifier = match[1];
        fileSlug = `${identifier}.mp4`;
        serverPathPrefix = "/download";
        
        // If there's another path part, it might be the file slug
        const paths = parsedUrl.pathname.split('/').filter(Boolean);
        const identifierIndex = paths.indexOf(identifier);
        if (identifierIndex !== -1 && paths.length > identifierIndex + 1) {
            fileSlug = paths.slice(identifierIndex + 1).join('/');
        }
      } else {
        // Node direct link: e.g. ia800608.us.archive.org/7/items/IDENTIFIER/FILE.mp4
        const itemsMatch = url.match(/(.*?)\/items\/([^/?#]+)\/([^?#]+)/);
        if (itemsMatch) {
          serverPathPrefix = `${itemsMatch[1]}/items`;
          identifier = itemsMatch[2];
          fileSlug = itemsMatch[3];
        } else {
            const paths = parsedUrl.pathname.split('/').filter(Boolean);
            if (paths.length > 0) {
              identifier = paths[0];
              fileSlug = paths.length > 1 ? paths.slice(1).join('/') : `${identifier}.mp4`;
            }
        }
      }

      const startParam = parsedUrl.searchParams.get('start');
      if (startParam) {
        start = parseFloat(startParam);
      }
      const endParam = parsedUrl.searchParams.get('end');
      if (endParam) {
        end = parseFloat(endParam);
      }
    }

    if (!identifier) {
      return null;
    }

    return { serverHost, serverPathPrefix, identifier, fileSlug, start, end };
  } catch (e) {
    if (!url.includes('/') && url.length > 0) {
       return { serverHost: "archive.org", serverPathPrefix: "/download", identifier: url, fileSlug: `${url}.mp4`, start: 0, end: 0 };
    }
    return null;
  }
}
