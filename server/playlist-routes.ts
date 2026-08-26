// server/playlist-routes.ts
import express from "express";
import { getDb } from "./db";
import { episodes, currentRundown } from "../shared/schema";
import { eq, inArray } from "drizzle-orm";
import { telemetry, LogLevel, LogCategory } from "../src/lib/telemetry";

export const playlistRoutes = express.Router();

playlistRoutes.delete("/api/playlist/clear", async (req, res) => {
  try {
    const db = getDb();
    
    telemetry.log('info' as LogLevel, 'system' as LogCategory, "Initiating physical deletion of the current playlist and rundown...");

    // Physically delete from the rundown table
    await db.delete(currentRundown);

    // Physically delete queued episodes from the episodes table
    const result = await db.delete(episodes).where(eq(episodes.status, "queued"));

    telemetry.log('info' as LogLevel, 'system' as LogCategory, "Successfully cleared playlist from database.");
    
    return res.status(200).json({ 
      success: true, 
      message: "Playlist physically cleared from database." 
    });
  } catch (error: any) {
    telemetry.log('error' as LogLevel, 'system' as LogCategory, `Failed to clear playlist: ${error.message}`);
    return res.status(500).json({ error: error.message });
  }
});

playlistRoutes.get("/api/playlist", async (req, res) => {
  try {
    const db = getDb();
    const items = await db.select().from(episodes).where(eq(episodes.status, "queued"));
    return res.status(200).json(items);
  } catch (error: any) {
    telemetry.log('error' as LogLevel, 'system' as LogCategory, `Failed to fetch playlist: ${error.message}`);
    return res.status(500).json({ error: error.message });
  }
});
