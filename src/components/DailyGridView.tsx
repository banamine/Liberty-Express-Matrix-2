/**
 * DailyGridView.tsx
 * ─────────────────
 * EPG (Electronic Program Guide) Daily Grid for the 24-hour linear broadcast.
 *
 * - Fetches /api/stream/schedule and renders a scrollable programme table.
 * - Color-coded: movie=purple, news_break=cyan, filler=gray.
 * - "NOW" indicator: highlights the block that is currently on-air based on
 *   BC (Pacific) wall-clock time.
 * - Shows wall-clock start times in Pacific Time (PT).
 */

import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import { Badge } from "@/src/components/ui/badge";
import { ScrollArea } from "@/src/components/ui/scroll-area";
import { Skeleton } from "@/src/components/ui/skeleton";
import { Tv2, Radio, Newspaper, Clock, Wifi, AlertTriangle } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ScheduleBlockUI {
  type: "movie" | "news_break" | "filler";
  startTime: number;     // seconds from stream start
  duration: number;      // seconds
  title: string;
  wallClockIso: string;  // UTC ISO — we convert to PT for display
  segmentCount: number;
}

interface ScheduleResponse {
  scheduleDate: string;
  streamStartIso: string;
  totalDurationSeconds: number;
  isFullDay: boolean;
  generatedAt: string;
  blocks: ScheduleBlockUI[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Format a UTC ISO timestamp as HH:MM in Pacific Time (America/Los_Angeles) */
function toPTTime(isoStr: string): string {
  return new Date(isoStr).toLocaleTimeString("en-US", {
    timeZone: "America/Los_Angeles",
    hour:     "2-digit",
    minute:   "2-digit",
    hour12:   true,
  });
}

/** Format seconds as h:mm:ss or m:ss */
function fmtDuration(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${sec.toString().padStart(2, "0")}s`;
  return `${sec}s`;
}

type BlockType = "movie" | "news_break" | "filler";

const TYPE_CONFIG: Record<
  BlockType,
  { label: string; color: string; icon: React.FC<{ className?: string }> }
> = {
  movie: {
    label: "Movie",
    color: "bg-purple-500/20 text-purple-200 border-purple-500/40",
    icon: Tv2,
  },
  news_break: {
    label: "News Break",
    color: "bg-cyan-500/20 text-cyan-200 border-cyan-500/40",
    icon: Newspaper,
  },
  filler: {
    label: "Filler",
    color: "bg-slate-500/20 text-slate-400 border-slate-500/40",
    icon: Radio,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function BlockRow({
  block,
  isNow,
}: {
  block: ScheduleBlockUI;
  isNow: boolean;
}) {
  const cfg   = TYPE_CONFIG[block.type];
  const Icon  = cfg.icon;
  const ptStr = toPTTime(block.wallClockIso);

  return (
    <tr
      className={
        "border-b border-white/5 transition-colors " +
        (isNow
          ? "bg-cyan-950/60 ring-1 ring-inset ring-cyan-500/50"
          : "hover:bg-white/[0.03]")
      }
      data-testid={`epg-row-${block.startTime}`}
    >
      {/* Wall-clock time */}
      <td className="px-3 py-2 whitespace-nowrap w-24">
        <span
          className={
            "font-mono text-xs " +
            (isNow ? "text-cyan-300 font-semibold" : "text-muted-foreground")
          }
        >
          {ptStr}
        </span>
        {isNow && (
          <span className="ml-1 inline-flex items-center gap-0.5 text-xs text-cyan-400 font-bold">
            <Wifi className="w-2.5 h-2.5 animate-pulse" />
            NOW
          </span>
        )}
      </td>

      {/* Type badge */}
      <td className="px-3 py-2 w-32">
        <span
          className={
            "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold border " +
            cfg.color
          }
        >
          <Icon className="w-3 h-3" />
          {cfg.label}
        </span>
      </td>

      {/* Title */}
      <td className="px-3 py-2">
        <span
          className={
            "text-xs leading-snug line-clamp-1 " +
            (isNow ? "text-cyan-100" : "text-foreground/80")
          }
          title={block.title}
        >
          {block.title}
        </span>
      </td>

      {/* Duration */}
      <td className="px-3 py-2 whitespace-nowrap w-20 text-right">
        <span className="font-mono text-[11px] text-muted-foreground">
          {fmtDuration(block.duration)}
        </span>
      </td>

      {/* Segments */}
      <td className="px-3 py-2 whitespace-nowrap w-16 text-right hidden sm:table-cell">
        <span className="font-mono text-[11px] text-muted-foreground/60">
          {block.segmentCount}
        </span>
      </td>
    </tr>
  );
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <tr key={i} className="border-b border-white/5">
          <td className="px-3 py-2 w-24"><Skeleton className="h-3 w-16" /></td>
          <td className="px-3 py-2 w-32"><Skeleton className="h-4 w-20 rounded" /></td>
          <td className="px-3 py-2"><Skeleton className="h-3 w-48" /></td>
          <td className="px-3 py-2 w-20 text-right"><Skeleton className="h-3 w-12 ml-auto" /></td>
          <td className="px-3 py-2 w-16 text-right hidden sm:table-cell"><Skeleton className="h-3 w-6 ml-auto" /></td>
        </tr>
      ))}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

interface DailyGridViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DailyGridView({ open, onOpenChange }: DailyGridViewProps) {
  const { data, isLoading, isError } = useQuery<ScheduleResponse>({
    queryKey: ["/api/stream/schedule"],
    retry: 1,
    queryFn: async () => {
      const res = await fetch("/api/stream/schedule");
      if (!res.ok) throw new Error("Failed to load schedule");
      return res.json();
    },
    enabled:  open,
    staleTime: 60_000,
  });

  // Determine which block is currently on-air
  const nowMs          = Date.now();
  const streamStartMs  = data ? new Date(data.streamStartIso).getTime() : 0;
  // Seconds elapsed since stream start (wraps within 24 h)
  const elapsedSeconds = data ? ((nowMs - streamStartMs) / 1000) % 86_400 : -1;

  function isNowBlock(block: ScheduleBlockUI): boolean {
    if (elapsedSeconds < 0) return false;
    return (
      elapsedSeconds >= block.startTime &&
      elapsedSeconds < block.startTime + block.duration
    );
  }

  // Stats
  const movieCount      = data?.blocks.filter((b) => b.type === "movie").length ?? 0;
  const breakCount      = data?.blocks.filter((b) => b.type === "news_break").length ?? 0;
  const fillerCount     = data?.blocks.filter((b) => b.type === "filler").length ?? 0;
  const scheduleDate    = data?.scheduleDate ?? "…";

  // Abort detection: 0 movies = failed schedule (regardless of break count)
  // Fires when all long-form episodes have duration=0 or the queue was empty.
  const isScheduleFailed = data !== undefined && movieCount === 0 && (data.blocks.length === 0 || breakCount > 0);

  // Date in PT for the title
  const ptDate = data?.streamStartIso
    ? new Date(data.streamStartIso).toLocaleDateString("en-US", {
        timeZone:  "America/Los_Angeles",
        weekday:   "long",
        month:     "long",
        day:       "numeric",
        year:      "numeric",
      })
    : scheduleDate;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-3xl w-full bg-black/90 border border-white/10 p-0 overflow-hidden"
        data-testid="dialog-daily-grid"
      >
        {/* Header */}
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-white/10">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <Clock className="w-4 h-4 text-cyan-400" />
            <span className="text-cyan-300">Daily Broadcast Schedule</span>
            <span className="text-muted-foreground font-normal text-sm ml-1">
              — {ptDate} (PT)
            </span>
          </DialogTitle>

          {/* Stats row */}
          {data && (
            <div className="flex flex-col gap-2 mt-2">
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1 text-[11px] text-purple-300">
                  <Tv2 className="w-3 h-3" />
                  {movieCount} movies
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] text-cyan-300">
                  <Newspaper className="w-3 h-3" />
                  {breakCount} news breaks
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                  <Radio className="w-3 h-3" />
                  {fillerCount} filler clips
                </span>
                {data.isFullDay && (
                  <Badge
                    variant="outline"
                    className="text-xs border-cyan-500/40 text-cyan-400 h-5"
                  >
                    24h FULL
                  </Badge>
                )}
              </div>
              {/* ABORT ALERT — fires when schedule generation failed */}
              {isScheduleFailed && (
                <div
                  id="fallback-banner"
                  data-testid="alert-schedule-failed"
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "10px",
                    borderRadius: "6px",
                    border: "1px solid rgba(255,140,0,0.7)",
                    background: "#FF8C00",
                    padding: "8px 12px",
                    boxShadow: "0 0 10px rgba(255,0,0,0.5), 0 0 24px rgba(255,140,0,0.3)",
                  }}
                >
                  <AlertTriangle
                    className="w-4 h-4 mt-0.5 shrink-0"
                    style={{ color: "#000000" }}
                  />
                  <div>
                    <p
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#000000",
                        letterSpacing: "1px",
                        margin: 0,
                        lineHeight: 1.4,
                      }}
                    >
                      SCHEDULE GENERATION FAILED — {movieCount} movies / {breakCount} news breaks
                    </p>
                    <p
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#1a1a1a",
                        letterSpacing: "0.5px",
                        marginTop: 4,
                        lineHeight: 1.4,
                      }}
                    >
                      All long-form episodes have no duration. Open the episode list,
                      select all, and run <strong>Probe Durations</strong> before
                      regenerating the schedule.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogHeader>

        {/* Table */}
        <ScrollArea className="h-[60vh]">
          <div className="w-full overflow-x-auto">
            <table className="w-full text-sm border-collapse min-w-[600px]">
              <thead>
                <tr className="sticky top-0 bg-black/80 backdrop-blur border-b border-white/10 z-10">
                  <th className="px-3 py-2 text-left text-[11px] font-semibold text-muted-foreground w-24">
                    Time (PT)
                  </th>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold text-muted-foreground w-32">
                    Type
                  </th>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold text-muted-foreground">
                    Programme
                  </th>
                  <th className="px-3 py-2 text-right text-[11px] font-semibold text-muted-foreground w-20">
                    Duration
                  </th>
                  <th className="px-3 py-2 text-right text-[11px] font-semibold text-muted-foreground w-16 hidden sm:table-cell">
                    Segs
                  </th>
                </tr>
              </thead>
              <tbody>
              {isLoading && <SkeletonRows />}
              {isError && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-8 text-center text-destructive text-sm"
                  >
                    Failed to load schedule. Check that the stream manifest has been
                    built.
                  </td>
                </tr>
              )}
              {data?.blocks.map((block) => (
                <BlockRow
                  key={`${block.startTime}-${block.type}`}
                  block={block}
                  isNow={isNowBlock(block)}
                />
              ))}
            </tbody>
            </table>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
