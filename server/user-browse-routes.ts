import type { Express } from "express";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "./db";
import { episodes, archiveHoldingQueue } from "../shared/schema";
import { isAllowedEntertainmentChannel } from "./playlist-filter";

export function registerUserBrowseRoutes(app: Express) {
  app.post("/api/archive/detect", (req, res) => {
    try {
      const { input } = req.body;
      if (!input) return res.json({ type: "search", searchQuery: "" });
      let str = input.trim();
      if (str.startsWith("@")) {
        return res.json({ type: "user-list", username: str.substring(1) });
      }
      try {
        const url = new URL(str);
        if (url.hostname.includes("archive.org")) {
           if (url.pathname.startsWith("/details/@")) {
             return res.json({ type: "user-list", username: url.pathname.split("/")[2].substring(1) });
           }
           if (url.pathname.startsWith("/services/collection-rss.php")) {
             return res.json({ type: "rss", identifier: str });
           }
        }
        return res.json({ type: "url", identifier: str });
      } catch (e) {
        return res.json({ type: "search", searchQuery: str });
      }
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/archive/user", async (req, res) => {
    try {
      const { username, page = 1, pageSize = 50, mediatype } = req.body;
      let q = `uploader:"${username}"`;
      if (mediatype) q += ` AND mediatype:"${mediatype}"`;
      const url = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(q)}&fl[]=identifier,title,mediatype,creator,date,downloads&sort[]=publicdate+desc&rows=${pageSize}&page=${page}&output=json`;
      const resp = await fetch(url);
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Archive API error: ${resp.status} ${text}`);
      }
      const data = await resp.json();
      const docs = data.response?.docs || [];
      const numFound = data.response?.numFound || 0;
      res.json({
        items: docs.map((d: any) => ({ ...d, thumbnailUrl: `https://archive.org/services/img/${d.identifier}` })),
        total: numFound, page, totalPages: Math.ceil(numFound / pageSize)
      });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/archive/user/:username/favorites", async (req, res) => {
    try {
      const { username } = req.params;
      const { page = 1, pageSize = 50 } = req.query;
      const q = `subject:"favorite" AND creator:"${username}"`; 
      res.json({ items: [], total: 0, page: Number(page), totalPages: 0, favCollectionId: '' });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/archive/list/:username", async (req, res) => {
    res.json({ success: true, lists: [] });
  });

  app.post("/api/archive/list/items", async (req, res) => {
    res.json({ success: true, items: [] });
  });

  app.post("/api/archive/import-search", async (req, res) => {
    try {
      const { items, groupTitle } = req.body;
      const db = getDb();
      let imported = 0;
      let skipped = 0;
      for (const item of items) {
        const identifier = item.identifier;
        if (!isAllowedEntertainmentChannel(groupTitle || '', identifier)) {
          skipped++;
          continue;
        }
        await db.insert(archiveHoldingQueue).values({
          identifier,
          filename: item.filename || '',
          thumbnailUrl: `https://archive.org/services/img/${identifier}`,
          status: 'pending',
          pendingEpisodeJson: JSON.stringify({ groupTitle, title: item.title, thumbnailUrl: item.thumbnailUrl, sizeMB: item.sizeMB, format: item.format }),
          fileSizeBytes: item.sizeMB ? Math.floor(item.sizeMB * 1024 * 1024) : 0
        }).onConflictDoNothing({ target: archiveHoldingQueue.identifier });
        imported++;
      }
      res.json({ message: `Imported ${imported} items`, imported });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/archive/user/items", async (req, res) => {
    try {
      const { identifiers } = req.body;
      if (!Array.isArray(identifiers)) {
        return res.status(400).json({ error: "identifiers must be an array" });
      }

      const result = {
        categorized: {
          video: [] as any[],
          audio: [] as any[],
          document: [] as any[],
          image: [] as any[],
          subtitle: [] as any[],
          other: [] as any[]
        },
        metadata: [] as any[],
        errors: [] as string[],
        totalFiles: 0
      };

      for (const id of identifiers) {
        try {
          const resp = await fetch(`https://archive.org/metadata/${id}`);
          if (!resp.ok) throw new Error(`Status ${resp.status}`);
          const data = await resp.json();
          const title = data.metadata?.title || id;
          result.metadata.push({ identifier: id, title });

          for (const f of data.files || []) {
            if (f.source === "metadata") continue;
            
            const format = (Array.isArray(f.format) ? f.format.join(' ') : String(f.format || "")).toLowerCase();
            const name = String(f.name || "").toLowerCase();
            let category = "other";
            if (
              format.includes("video") || format.includes("mp4") || format.includes("mkv") || format.includes("mpeg") || format.includes("h.264") || format.includes("theora") || format.includes("quicktime") ||
              name.endsWith(".mp4") || name.endsWith(".mkv") || name.endsWith(".avi") || name.endsWith(".mov") || name.endsWith(".webm")
            ) category = "video";
            else if (format.includes("audio") || format.includes("mp3") || format.includes("flac") || format.includes("wav") || name.endsWith(".mp3") || name.endsWith(".ogg") || name.endsWith(".wav") || name.endsWith(".flac")) category = "audio";
            else if (format.includes("pdf") || format.includes("epub") || format.includes("text") || format.includes("document") || name.endsWith(".pdf") || name.endsWith(".epub") || name.endsWith(".txt")) category = "document";
            else if (format.includes("image") || format.includes("jpeg") || format.includes("png") || format.includes("gif") || name.endsWith(".jpg") || name.endsWith(".jpeg") || name.endsWith(".png") || name.endsWith(".gif")) category = "image";
            else if (format.includes("subrip") || format.includes("srt") || format.includes("vtt") || name.endsWith(".srt") || name.endsWith(".vtt")) category = "subtitle";

            const fileObj = {
              identifier: id,
              filename: f.name,
              title: title,
              url: `https://archive.org/download/${id}/${encodeURIComponent(f.name)}`,
              thumbnailUrl: `https://archive.org/services/img/${id}`,
              duration: parseFloat(f.length) || 0,
              format: f.format,
              size: parseInt(f.size) || 0,
              category
            };

            if (category === "video") result.categorized.video.push(fileObj);
            else if (category === "audio") result.categorized.audio.push(fileObj);
            else if (category === "document") result.categorized.document.push(fileObj);
            else if (category === "image") result.categorized.image.push(fileObj);
            else if (category === "subtitle") result.categorized.subtitle.push(fileObj);
            else result.categorized.other.push(fileObj);
            
            result.totalFiles++;
          }
        } catch (e: any) {
          result.errors.push(`Failed to fetch ${id}: ${e.message}`);
        }
      }

      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/archive/import-selected", async (req, res) => {
    try {
      const { files, groupTitle } = req.body;
      const db = getDb();
      let count = 0;
      for (const f of files || []) {
        await db.insert(episodes).values({
          id: uuidv4(),
          season: 1,
          episode: 1,
          title: f.title || f.identifier,
          url: f.url || `https://archive.org/download/${f.identifier}/${f.identifier}.mp4`,
          duration: f.duration || 0,
          groupTitle: groupTitle || "",
          tvgId: f.identifier,
          tvgName: f.title || f.identifier,
          tvgLogo: f.thumbnailUrl || `https://archive.org/services/img/${f.identifier}`,
          allowedPlayers: ["player1", "player2"],
        }).onConflictDoNothing();
        count++;
      }
      res.json({ message: `Imported ${count}`, imported: count });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/archive/rss-browse", async (req, res) => {
    res.json({ items: [], total: 0, page: 1, totalPages: 0 });
  });

  app.post("/api/archive/pivot", async (req, res) => {
    res.json({ pivotEmail: "" });
  });
}
