import fs from 'fs';
import path from 'path';

export interface TimeSeriesEntry {
  id: string;
  url: string;
  title: string;
  timestamp: string; // ISO format
  status: "ARCHIVED" | "PLAYED_YESTERDAY" | "PLAYED_LAST_HOUR" | "PLAYING_NOW" | "UPCOMING_NEXT" | "QUEUED_FUTURE";
  duration?: number;
  metadata?: any;
}

const DB_DIR = path.join(process.cwd(), 'db', 'archives');

export function getArchiveFilePath(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return path.join(DB_DIR, `${year}-${month}.json`);
}

export function ensureDbDir() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
}

export function writeTimeSeriesEntry(entry: TimeSeriesEntry) {
  ensureDbDir();
  const date = new Date(entry.timestamp);
  const filePath = getArchiveFilePath(date);
  
  let data: Record<string, TimeSeriesEntry> = {};
  if (fs.existsSync(filePath)) {
    try {
      data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (e) {
      console.error("Error parsing archive file:", filePath, e);
    }
  }
  
  data[entry.id] = entry;
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

export function readTimeSeriesMonth(year: number, month: number): Record<string, TimeSeriesEntry> {
  const fileMonth = String(month).padStart(2, '0');
  const filePath = path.join(DB_DIR, `${year}-${fileMonth}.json`);
  if (!fs.existsSync(filePath)) return {};
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (e) {
    console.error("Error parsing archive file:", filePath, e);
    return {};
  }
}

export function computeStatus(entryDate: Date, now: Date = new Date()): TimeSeriesEntry['status'] {
  const diffMs = entryDate.getTime() - now.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours > 0) {
    if (diffHours < 1) return "UPCOMING_NEXT";
    return "QUEUED_FUTURE";
  } else {
    const pastHours = Math.abs(diffHours);
    if (pastHours < 1) return "PLAYING_NOW";
    if (pastHours < 2) return "PLAYED_LAST_HOUR";
    if (pastHours < 24) return "PLAYED_YESTERDAY";
    return "ARCHIVED";
  }
}

export function updateEntryStatuses(year: number, month: number) {
  const fileMonth = String(month).padStart(2, '0');
  const filePath = path.join(DB_DIR, `${year}-${fileMonth}.json`);
  if (!fs.existsSync(filePath)) return;
  try {
    const data: Record<string, TimeSeriesEntry> = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    let changed = false;
    const now = new Date();
    for (const id in data) {
      const entry = data[id];
      const newStatus = computeStatus(new Date(entry.timestamp), now);
      if (entry.status !== newStatus) {
        entry.status = newStatus;
        changed = true;
      }
    }
    if (changed) {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    }
  } catch (e) {
    console.error("Error updating statuses:", filePath, e);
  }
}
