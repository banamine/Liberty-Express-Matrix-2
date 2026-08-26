import { forwardRef, useRef, useEffect, useState, useMemo, useCallback } from "react";
import { CheckCircle2, AlertCircle, XCircle, Edit, ArrowUpDown, Film, Newspaper, Clapperboard, Zap, Loader2, GitMerge, ChevronDown, ChevronRight, Layers, RefreshCw, VideoOff, Pencil, Check, X, Lock, Unlock, Flame, Music, Radio, Baby, Scissors, BookOpen, Trophy, Megaphone, HardDrive } from "lucide-react";
import type { ContentType } from "@shared/schema";

const CT_STYLE: Record<string, { bg: string; fg: string; label: string; Icon: React.ComponentType<{ className?: string }> }> = {
  news:         { bg: "rgba(251,191,36,0.18)",  fg: "#fbbf24", label: "NEWS",         Icon: Newspaper },
  movie:        { bg: "rgba(96,165,250,0.18)",  fg: "#60a5fa", label: "MOVIE",        Icon: Clapperboard },
  series:       { bg: "rgba(167,139,250,0.18)", fg: "#a78bfa", label: "SERIES",       Icon: Film },
  music:        { bg: "rgba(52,211,153,0.18)",  fg: "#34d399", label: "MUSIC",        Icon: Music },
  radio:        { bg: "rgba(251,113,133,0.18)", fg: "#fb7185", label: "RADIO",        Icon: Radio },
  kids:         { bg: "rgba(250,204,21,0.18)",  fg: "#facc15", label: "KIDS",         Icon: Baby },
  short:        { bg: "rgba(249,115,22,0.18)",  fg: "#f97316", label: "SHORT",        Icon: Scissors },
  documentary:  { bg: "rgba(34,211,238,0.18)",  fg: "#22d3ee", label: "DOC",          Icon: BookOpen },
  sports:       { bg: "rgba(74,222,128,0.18)",  fg: "#4ade80", label: "SPORTS",       Icon: Trophy },
  promo:        { bg: "rgba(244,114,182,0.18)", fg: "#f472b6", label: "PROMO",        Icon: Megaphone },
};
import { Checkbox } from "@/src/components/ui/checkbox";
import { Button } from "@/src/components/ui/button";
import { Badge } from "@/src/components/ui/badge";
import { Skeleton } from "@/src/components/ui/skeleton";
import { TableVirtuoso } from "react-virtuoso";
import type { Episode } from "@shared/schema";
import { getContentTier, formatDuration } from "@/src/lib/utils";
import { apiRequest } from "@/src/lib/queryClient";
import { queryClient } from "@/src/lib/queryClient";

// A dummy fallback just for the sake of the demo, in a real app this would be a real image
const PHAR_LAP_BASE64 = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
const secretariatImg = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
const pharLapImg = PHAR_LAP_BASE64;

// Horse Rule: fallback thumbnail based on episode index (never archive.org/services/img)
function getHorseFallback(episodeNum: number): string {
  return episodeNum % 2 === 0 ? pharLapImg : secretariatImg;
}

// PERMANENT BAN: archive.org/services/img is a lazy guess — forbidden in workbench display.
const BANNED_THUMB = "archive.org/services/img";

function resolveThumbSrc(episode: Episode, episodeNum: number): string {
  const thumb = episode.thumbnailUrl || "";
  const logo = episode.tvgLogo || "";

  // WHITELIST: .thumbs/ is a verified archive.org frame capture — always trust it, no bans
  if (thumb.includes(".thumbs/")) return thumb;
  if (logo.includes(".thumbs/")) return logo;

  const badLocalAsset = (url: string) =>
    url.includes("image_") || url.includes(".png") || url.includes("screenshot");
  if (badLocalAsset(thumb) || badLocalAsset(logo)) return getHorseFallback(episodeNum);
  if (thumb.includes("/logos/") || thumb.includes(BANNED_THUMB)) return getHorseFallback(episodeNum);
  if (logo.includes("/logos/") || logo.includes(BANNED_THUMB)) return getHorseFallback(episodeNum);
  if (thumb) return thumb;
  if (logo) return logo;
  return getHorseFallback(episodeNum);
}

function LogoCell({ src }: { src: string }) {
  return (
    <img
      src={src || PHAR_LAP_BASE64}
      alt=""
      className="w-16 h-10 object-cover rounded bg-muted"
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).src = PHAR_LAP_BASE64;
      }}
    />
  );
}

function ThumbCell({
  episode,
  episodeIndex,
  refreshingIds,
  failedIds,
  onRefreshExpired,
  onRowClick,
}: {
  episode: Episode;
  episodeIndex: number;
  refreshingIds: string[];
  failedIds: string[];
  onRefreshExpired?: (ids: string[]) => void;
  onRowClick?: (ep: Episode) => void;
}) {
  const isYtExpired =
    episode.sourceType === "youtube" &&
    episode.expiresAt != null &&
    new Date(episode.expiresAt as unknown as string) < new Date();
  const isRefreshing = refreshingIds.includes(episode.id);
  const isDead       = failedIds.includes(episode.id);
  const showOverlay  = isYtExpired || isDead;

  const isLocked = !!episode.thumbnailLocked;

  const [dragOver, setDragOver]     = useState(false);
  const [dragBlocked, setDragBlocked] = useState(false);
  const [editing, setEditing]       = useState(false);
  const [urlInput, setUrlInput]     = useState("");
  const [saving, setSaving]         = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const thumbSrc = resolveThumbSrc(episode, episodeIndex);

  const saveThumbnail = useCallback(async (url: string, forceUnlock = false) => {
    const trimmed = url.trim();
    if (!trimmed) return;
    // Respect lock — never overwrite a locked thumbnail unless user explicitly unlocks
    if (isLocked && !forceUnlock) return;
    setSaving(true);
    try {
      await apiRequest("PATCH", `/api/episodes/${episode.id}`, {
        thumbnailUrl: trimmed,
        tvgLogo: trimmed,
        thumbnailLocked: true,  // any explicit save auto-locks
      });
      queryClient.setQueryData<Episode[]>(["/api/episodes"], (current) =>
        current?.map((item) => (
          item.id === episode.id ? { ...item, thumbnailUrl: trimmed, tvgLogo: trimmed, thumbnailLocked: true } : item
        )) ?? current
      );
      queryClient.invalidateQueries({ queryKey: ["/api/episodes"] });
    } catch {
      // silent — let the thumbnail fail naturally
    } finally {
      setSaving(false);
      setEditing(false);
    }
  }, [episode.id, isLocked]);

  const toggleLock = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await apiRequest("PATCH", `/api/episodes/${episode.id}`, {
        thumbnailLocked: !isLocked,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/episodes"] });
    } catch { /* silent */ }
  }, [episode.id, isLocked]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isLocked) { setDragBlocked(true); return; }
    setDragOver(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    setDragBlocked(false);
  };
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    setDragBlocked(false);
    if (isLocked) return;  // LOCKED — silently ignore drops
    // File drop
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        if (dataUrl) saveThumbnail(dataUrl, true);
      };
      reader.readAsDataURL(file);
      return;
    }
    // URL drop
    const uri = e.dataTransfer.getData("text/uri-list") || e.dataTransfer.getData("text/plain");
    if (uri && uri.startsWith("http")) {
      saveThumbnail(uri, true);
    }
  };

  const openEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setUrlInput(episode.thumbnailUrl || episode.tvgLogo || "");
    setEditing(true);
  };
  const cancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditing(false);
  };
  const commitEdit = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    saveThumbnail(urlInput, true);  // pencil editor always overrides lock
  };

  return (
    <td
      className="w-20 px-2 py-2"
      data-testid={`thumb-${episode.id}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {editing ? (
        <div
          className="w-16 flex flex-col gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Lock/Unlock row */}
          <div className="flex items-center gap-1 mb-0.5">
            <button
              onClick={toggleLock}
              className="flex items-center gap-1 text-xs font-mono leading-none"
              style={{ color: isLocked ? "#d4af37" : "rgba(255,255,255,0.4)" }}
              title={isLocked ? "Click to unlock thumbnail" : "Click to lock thumbnail"}
              data-testid={`button-thumb-lock-${episode.id}`}
            >
              {isLocked
                ? <><Lock className="w-2.5 h-2.5" /> LOCKED</>
                : <><Unlock className="w-2.5 h-2.5" /> UNLOCKED</>
              }
            </button>
          </div>
          <input
            ref={inputRef}
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitEdit(e);
              if (e.key === "Escape") { e.stopPropagation(); setEditing(false); }
            }}
            placeholder="Paste URL…"
            className="w-full text-xs px-1 py-0.5 rounded bg-background border border-border text-foreground leading-tight"
            data-testid={`input-thumb-url-${episode.id}`}
          />
          <div className="flex gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-5 w-5 shrink-0"
              onClick={commitEdit}
              disabled={saving}
              data-testid={`button-thumb-save-${episode.id}`}
            >
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3 text-emerald-500" />}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-5 w-5 shrink-0"
              onClick={cancelEdit}
              data-testid={`button-thumb-cancel-${episode.id}`}
            >
              <X className="w-3 h-3 text-red-400" />
            </Button>
          </div>
        </div>
      ) : (
        <div
          className="relative w-16 h-10 group"
          style={{
            cursor: isDead ? "not-allowed" : "pointer",
            outline: dragBlocked ? "2px solid #d97706" : dragOver ? "2px solid #10b981" : undefined,
            boxShadow: dragBlocked ? "0 0 0 3px rgba(217,119,6,0.6)" : dragOver ? "0 0 0 3px rgba(16,185,129,0.4)" : undefined,
            borderRadius: "4px",
          }}
          onClick={() =>
            isDead
              ? undefined
              : isYtExpired && onRefreshExpired
              ? onRefreshExpired([episode.id])
              : onRowClick?.(episode)
          }
          title={
            isDead
              ? "Video is unavailable (deleted or private)"
              : isYtExpired
              ? "YouTube link expired — click to refresh all visible"
              : isLocked
              ? "Thumbnail locked — click pencil to edit or unlock"
              : "Drop an image or URL to set thumbnail"
          }
        >
          <LogoCell src={thumbSrc} />
          {/* Lock badge — always visible when locked */}
          {isLocked && !showOverlay && (
            <div
              className="absolute top-0 left-0 p-0.5 bg-black/70 rounded-br z-20"
              title="Thumbnail locked"
            >
              <Lock className="w-2.5 h-2.5 text-yellow-400" />
            </div>
          )}
          {showOverlay && (
            <div className="absolute inset-0 flex items-center justify-center rounded bg-black/60 z-10">
              {isDead ? (
                <VideoOff className="w-4 h-4 text-red-400 drop-shadow" />
              ) : isRefreshing ? (
                <Loader2 className="w-4 h-4 text-yellow-400 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 text-yellow-400 drop-shadow" />
              )}
            </div>
          )}
          {/* Pencil edit button — visible on hover */}
          <button
            className="absolute bottom-0 right-0 p-0.5 bg-black/70 rounded-tl rounded-br opacity-0 group-hover:opacity-100 transition-opacity z-20"
            onClick={openEdit}
            title={isLocked ? "Edit / unlock thumbnail" : "Edit thumbnail URL"}
            data-testid={`button-thumb-edit-${episode.id}`}
          >
            <Pencil className="w-2.5 h-2.5 text-yellow-400" />
          </button>
        </div>
      )}
    </td>
  );
}

const VirtuosoTableComponents = {
  Table: forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(
    ({ style, ...props }, ref) => (
      <table
        ref={ref}
        {...props}
        style={style}
        className="w-full caption-bottom text-sm border-collapse"
      />
    )
  ),
  TableHead: forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
    ({ style, ...props }, ref) => (
      <thead ref={ref} {...props} style={style} className="sticky top-0 z-10" />
    )
  ),
  TableBody: forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
    ({ style, ...props }, ref) => (
      <tbody ref={ref} {...props} style={style} />
    )
  ),
  TableRow: forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
    ({ style, ...props }, ref) => (
      <tr
        ref={ref}
        {...props}
        style={style}
        className="border-b transition-colors hover:bg-muted/40"
      />
    )
  ),
} as const;

// Season header row marker
type SeasonHeaderRow = {
  _isSeasonHeader: true;
  season: number;
  label: string;
  episodeCount: number;
};

type FlatRow = SeasonHeaderRow | Episode;

function detectSeasonFromEpisode(ep: Episode): number {
  if (ep.season > 0) return ep.season;
  // Try S01E01 format in title
  const m1 = ep.title.match(/\bS(\d{1,3})E\d+/i);
  if (m1) return parseInt(m1[1], 10);
  // Try 1x01 format in title
  const m2 = ep.title.match(/\b(\d{1,3})x\d{2,}\b/i);
  if (m2) return parseInt(m2[1], 10);
  return 0;
}

interface EpisodeTableProps {
  episodes: Episode[];
  hasMore: boolean;
  onLoadMore: () => void;
  isFetchingMore?: boolean;
  selectedIds: string[];
  onSelectAll: (checked: boolean | "indeterminate") => void;
  onToggle: (id: string, event?: React.MouseEvent) => void;
  onEditEpisode?: (episode: Episode) => void;
  onRowClick?: (episode: Episode) => void;
  onToggleContentType?: (id: string, newType: "news" | "movie") => void;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  onSortChange?: (col: string, dir: "asc" | "desc") => void;
  isLoading?: boolean;
  scrollToIndex?: number | null;
  seasonView?: boolean;
  onSeasonViewChange?: (v: boolean) => void;
  onRefreshExpired?: (ids: string[]) => void;
  refreshingIds?: string[];
  /** Episode IDs confirmed dead (deleted/private) — shows permanent red VideoOff icon */
  failedIds?: string[];
}

function getStatusIcon(status: string) {
  switch (status) {
    case "valid":
      return <CheckCircle2 className="w-4 h-4 text-green-600" />;
    case "redirected":
      return (
        <span title="Redirected — accessible">
          <GitMerge className="w-4 h-4 text-green-500" />
        </span>
      );
    case "warning":
      return <AlertCircle className="w-4 h-4 text-yellow-600" />;
    case "invalid":
      return <XCircle className="w-4 h-4 text-destructive" />;
    case "deriving":
      return (
        <span title="Deriving on Archive.org">
          <Loader2 className="w-4 h-4 text-cyan-500 animate-spin" />
        </span>
      );
    case "pending":
      return null;
    default:
      return null;
  }
}


export default function EpisodeTable({
  episodes,
  hasMore,
  onLoadMore,
  isFetchingMore = false,
  selectedIds,
  onSelectAll,
  onToggle,
  onEditEpisode,
  onRowClick,
  onToggleContentType,
  sortBy = "season",
  sortDir = "asc",
  onSortChange,
  isLoading = false,
  scrollToIndex,
  seasonView = false,
  onSeasonViewChange,
  onRefreshExpired,
  refreshingIds = [],
  failedIds = [],
}: EpisodeTableProps) {
  const virtuosoRef = useRef<any>(null);
  const [collapsedSeasons, setCollapsedSeasons] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (scrollToIndex != null && scrollToIndex >= 0 && virtuosoRef.current) {
      virtuosoRef.current.scrollToIndex({
        index: scrollToIndex,
        align: "start",
        behavior: "smooth",
      });
    }
  }, [scrollToIndex]);

  // Reset collapsed seasons when season view is toggled off
  useEffect(() => {
    if (!seasonView) setCollapsedSeasons(new Set());
  }, [seasonView]);

  const selectableEpisodes = episodes.filter((ep) => !ep.id.startsWith("holding:"));
  const allSelected =
    selectableEpisodes.length > 0 && selectedIds.length === selectableEpisodes.length;
  const someSelected =
    selectedIds.length > 0 && selectedIds.length < selectableEpisodes.length;

  const handleSort = (col: string) => {
    if (!onSortChange) return;
    if (sortBy === col) {
      onSortChange(col, sortDir === "asc" ? "desc" : "asc");
    } else {
      onSortChange(col, "asc");
    }
  };

  const SortIcon = ({ col }: { col: string }) => (
    <ArrowUpDown
      className={`ml-1.5 w-3 h-3 ${sortBy === col ? "text-primary" : "opacity-40"}`}
    />
  );

  // Season-grouped flat row list
  const flatRows: FlatRow[] = useMemo(() => {
    if (!seasonView) return episodes;

    const groups = new Map<number, Episode[]>();
    for (const ep of episodes) {
      const season = detectSeasonFromEpisode(ep);
      if (!groups.has(season)) groups.set(season, []);
      groups.get(season)!.push(ep);
    }

    // Sort seasons: ungrouped (0) last
    const sortedSeasons = [...groups.keys()].sort((a, b) => {
      if (a === 0) return 1;
      if (b === 0) return -1;
      return a - b;
    });

    const rows: FlatRow[] = [];
    for (const season of sortedSeasons) {
      const eps = groups.get(season)!;
      const label = season === 0 ? "Ungrouped" : `Season ${season}`;
      const header: SeasonHeaderRow = {
        _isSeasonHeader: true,
        season,
        label,
        episodeCount: eps.length,
      };
      rows.push(header);
      if (!collapsedSeasons.has(season)) {
        rows.push(...eps);
      }
    }
    return rows;
  }, [seasonView, episodes, collapsedSeasons]);

  const toggleSeason = (season: number) => {
    setCollapsedSeasons((prev) => {
      const next = new Set(prev);
      if (next.has(season)) next.delete(season);
      else next.add(season);
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="border rounded-md overflow-hidden">
        <div className="border-b bg-muted/50 px-4 py-2.5 flex gap-4">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 flex-1 max-w-xs" />
          <Skeleton className="h-4 w-24" />
        </div>
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 px-4 py-2.5 border-b"
          >
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-10 w-16 rounded" />
            <Skeleton className="h-5 w-12 rounded-full" />
            <Skeleton className="h-5 w-12 rounded-full" />
            <Skeleton className="h-4 flex-1 max-w-xs" />
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-4 w-10" />
            <Skeleton className="h-4 w-4 rounded-full" />
            <Skeleton className="h-8 w-8 rounded-md ml-auto" />
          </div>
        ))}
      </div>
    );
  }

  if (episodes.length === 0 && !isFetchingMore) {
    return (
      <div
        className="border rounded-md text-center py-16 text-muted-foreground"
        data-testid="text-empty-state"
      >
        <p>No episodes to display. Import an M3U file to get started.</p>
      </div>
    );
  }

  const COL_COUNT = 10; // 10 header columns (checkbox, thumb, season, episode, title, group, duration, date, status, type/actions)

  return (
    <div className="border rounded-md overflow-hidden flex flex-col h-full">
      <TableVirtuoso
        ref={virtuosoRef}
        style={{ height: "100%", flex: 1 }}
        data={flatRows}
        endReached={() => {
          if (hasMore && !isFetchingMore) onLoadMore();
        }}
        overscan={200}
        fixedHeaderContent={() => (
          <tr className="bg-muted/80 border-b">
            <th className="w-12 px-3 py-2.5 text-left">
              <Checkbox
                checked={allSelected || (someSelected ? "indeterminate" : false)}
                onCheckedChange={onSelectAll}
                aria-label="Select all"
                data-testid="checkbox-select-all"
              />
            </th>
            <th className="w-20 px-2 py-2.5 text-left font-semibold uppercase tracking-wide text-xs text-muted-foreground">
              Thumb
            </th>
            <th className="w-24 px-2 py-2.5 text-left">
              <button
                className="flex items-center font-semibold uppercase tracking-wide text-xs text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => handleSort("season")}
                data-testid="button-sort-season"
              >
                Season
                <SortIcon col="season" />
              </button>
            </th>
            <th className="w-24 px-2 py-2.5 text-left">
              <button
                className="flex items-center font-semibold uppercase tracking-wide text-xs text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => handleSort("episode")}
                data-testid="button-sort-episode"
              >
                Episode
                <SortIcon col="episode" />
              </button>
            </th>
            <th className="px-2 py-2.5 text-left">
              <button
                className="flex items-center font-semibold uppercase tracking-wide text-xs text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => handleSort("title")}
                data-testid="button-sort-title"
              >
                Title
                <SortIcon col="title" />
              </button>
            </th>
            <th className="w-40 px-2 py-2.5 text-left">
              <button
                className="flex items-center font-semibold uppercase tracking-wide text-xs text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => handleSort("groupTitle")}
                data-testid="button-sort-group"
                data-sort-col="groupTitle"
              >
                Group
                <SortIcon col="groupTitle" />
              </button>
            </th>
            <th className="w-32 px-2 py-2.5 text-left font-semibold uppercase tracking-wide text-xs text-muted-foreground">
              Player Route
            </th>
            <th className="w-24 px-2 py-2.5 text-left">
              <button
                className="flex items-center font-semibold uppercase tracking-wide text-xs text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => handleSort("duration")}
                data-testid="button-sort-duration"
                data-sort-col="duration"
                title={sortBy === "duration" ? (sortDir === "asc" ? "Shortest to longest" : "Longest to shortest") : "Sort by duration"}
              >
                Duration
                <SortIcon col="duration" />
              </button>
            </th>
            <th className="w-36 px-2 py-2.5 text-left">
              <button
                className="flex items-center font-semibold uppercase tracking-wide text-xs text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => handleSort("importedAt")}
                data-testid="button-sort-date"
                title={sortBy === "importedAt" ? (sortDir === "asc" ? "Oldest first" : "Newest first") : "Sort by import date"}
              >
                Date
                <SortIcon col="importedAt" />
              </button>
            </th>
            <th className="w-20 px-2 py-2.5 text-left font-semibold uppercase tracking-wide text-xs text-muted-foreground">
              Status
            </th>
            <th className="w-28 px-2 py-2.5 text-left font-semibold uppercase tracking-wide text-xs text-muted-foreground">
              <div className="flex items-center justify-between gap-1">
                <span>Type / Actions</span>
                {onSeasonViewChange && (
                  <button
                    onClick={() => onSeasonViewChange(!seasonView)}
                    title={seasonView ? "Exit season view" : "Group by season"}
                    className={`p-0.5 rounded transition-colors ${seasonView ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
                    data-testid="button-toggle-season-view"
                  >
                    <Layers className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </th>
          </tr>
        )}
        itemContent={(_index, row) => {
          // Season header row
          if ("_isSeasonHeader" in row && row._isSeasonHeader) {
            const isCollapsed = collapsedSeasons.has(row.season);
            return (
              <td colSpan={COL_COUNT} className="px-0 py-0">
                <button
                  className="w-full flex items-center gap-2 px-3 py-2 bg-primary/8 hover:bg-primary/12 text-left transition-colors border-l-[3px] border-l-primary/40"
                  onClick={() => toggleSeason(row.season)}
                  data-testid={`button-season-header-${row.season}`}
                >
                  {isCollapsed ? (
                    <ChevronRight className="w-3.5 h-3.5 text-primary shrink-0" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-primary shrink-0" />
                  )}
                  <span className="text-xs font-semibold text-primary uppercase tracking-wide">
                    {row.label}
                  </span>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-1">
                    {row.episodeCount}
                  </Badge>
                </button>
              </td>
            );
          }

          const episode = row as Episode;
          const isPlaceholder = episode.id.startsWith("holding:");
          if (isPlaceholder) {
            return (
              <>
                <td className="w-12 px-3 py-2">
                  <Checkbox disabled aria-label="Queued item" />
                </td>
                <td className="w-20 px-2 py-2">
                  <div className="w-16 h-10 bg-cyan-500/10 rounded flex items-center justify-center">
                    <Loader2 className="w-4 h-4 text-cyan-500 animate-spin" />
                  </div>
                </td>
                <td className="w-24 px-2 py-2" />
                <td className="w-24 px-2 py-2" />
                <td className="px-2 py-2 font-medium max-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge className="text-[10px] px-1 py-0 bg-cyan-600 text-white shrink-0">
                      DERIVING
                    </Badge>
                    <span className="truncate text-muted-foreground text-xs">{episode.title}</span>
                  </div>
                </td>
                <td className="w-32 px-2 py-2">
                  <Badge variant="outline" className="text-xs text-cyan-500 border-cyan-500/40">
                    Holding Queue
                  </Badge>
                </td>
                <td className="w-24 px-2 py-2 text-muted-foreground text-xs">—</td>
                <td className="w-20 px-2 py-2 text-muted-foreground text-xs">—</td>
                <td className="w-20 px-2 py-2">
                  <Loader2 className="w-4 h-4 text-cyan-500 animate-spin" />
                </td>
                <td className="w-24 px-2 py-2" />
              </>
            );
          }
          return (
          <>
            <td
              className="w-12 px-3 py-2"
              onClick={(e) => {
                e.stopPropagation();
                onToggle(episode.id, e);
              }}
            >
              <Checkbox
                checked={selectedIds.includes(episode.id)}
                onCheckedChange={(checked) => {
                  if (typeof checked === "boolean") {
                    onToggle(episode.id);
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                aria-label={`Select episode ${episode.id}`}
                data-testid={`checkbox-episode-${episode.id}`}
              />
            </td>
            <ThumbCell
              episode={episode}
              episodeIndex={episode.episode}
              refreshingIds={refreshingIds}
              failedIds={failedIds}
              onRefreshExpired={onRefreshExpired}
              onRowClick={onRowClick}
            />
            <td
              className="w-24 px-2 py-2 cursor-pointer"
              onClick={() => onRowClick?.(episode)}
            >
              <Badge
                variant="secondary"
                className="font-mono"
                data-testid={`badge-season-${episode.id}`}
              >
                S{episode.season.toString().padStart(2, "0")}
              </Badge>
            </td>
            <td
              className="w-24 px-2 py-2 cursor-pointer"
              onClick={() => onRowClick?.(episode)}
            >
              <Badge
                variant="secondary"
                className="font-mono"
                data-testid={`badge-episode-${episode.id}`}
              >
                E{episode.episode.toString().padStart(2, "0")}
              </Badge>
            </td>
            <td
              className="px-2 py-2 font-medium cursor-pointer max-w-0"
              onClick={() => onRowClick?.(episode)}
              data-testid={`text-title-${episode.id}`}
            >
              <div className="flex items-center gap-1 min-w-0">
                {episode.url?.startsWith('blob:') && (
                  <span title="Local file — session only, lost on page refresh">
                    <HardDrive
                      className="w-3 h-3 shrink-0 text-amber-500"
                    />
                  </span>
                )}
                <span className="truncate">{episode.title}</span>
              </div>
            </td>
            <td
              className="w-32 px-2 py-2 cursor-pointer"
              onClick={() => onRowClick?.(episode)}
              data-testid={`text-group-${episode.id}`}
            >
              {episode.groupTitle ? (
                <Badge
                  variant="outline"
                  className="text-xs truncate max-w-[112px] block"
                >
                  {episode.groupTitle}
                </Badge>
              ) : (
                <span className="text-muted-foreground text-xs">-</span>
              )}
            </td>
            <td
              className="w-24 px-2 py-2 font-mono text-muted-foreground text-xs cursor-pointer"
              onClick={() => onRowClick?.(episode)}
              data-testid={`text-duration-${episode.id}`}
            >
              {formatDuration(episode.duration)}
            </td>
            <td
              className="w-20 px-2 py-2 text-muted-foreground text-xs cursor-pointer"
              onClick={() => onRowClick?.(episode)}
              data-testid={`text-date-${episode.id}`}
            >
              {episode.importedAt
                ? new Date(episode.importedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "2-digit" })
                : <span className="opacity-40">—</span>}
            </td>
            <td
              className="w-20 px-2 py-2 cursor-pointer"
              onClick={() => onRowClick?.(episode)}
              data-testid={`status-${episode.id}`}
            >
              {getStatusIcon(episode.status)}
            </td>
            <td className="w-24 px-2 py-2">
              <div className="flex items-center gap-1 flex-wrap">
                {getContentTier(episode.duration ?? 0) === "mini" && (
                  <Badge
                    variant="outline"
                    className="text-[10px] font-bold px-1 py-0 leading-none text-orange-500 border-orange-400 dark:text-orange-400 dark:border-orange-500"
                    data-testid={`badge-mini-${episode.id}`}
                  >
                    Mini
                  </Badge>
                )}
                {episode.preempt && (
                  <span title="Preempt item — will interrupt current program" className="text-orange-500">
                    <Flame className="w-3 h-3" data-testid={`icon-preempt-${episode.id}`} />
                  </span>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const current = (episode.contentType || "movie") as ContentType;
                    onToggleContentType?.(episode.id, current === "news" ? "movie" : "news");
                  }}
                  className="inline-flex items-center gap-0.5 text-xs font-bold px-1.5 py-0.5 rounded-sm leading-none cursor-pointer transition-colors"
                  style={(() => {
                    const ct = episode.contentType || "movie";
                    const isMiniNews = ct === "news" && (episode.duration ?? 0) > 0 && (episode.duration ?? 0) <= 300;
                    if (isMiniNews) return { backgroundColor: "rgba(249,115,22,0.2)", color: "#f97316" };
                    const style = CT_STYLE[ct] ?? CT_STYLE.movie;
                    return { backgroundColor: style.bg, color: style.fg };
                  })()}
                  title={`Click to toggle news/movie. Currently: ${episode.contentType || "movie"}${(episode.duration ?? 0) > 0 && (episode.duration ?? 0) <= 300 && (episode.contentType || "movie") === "news" ? " (Mini-News)" : ""}`}
                  data-testid={`badge-content-type-${episode.id}`}
                >
                  {(() => {
                    const ct = episode.contentType || "movie";
                    const isMiniNews = ct === "news" && (episode.duration ?? 0) > 0 && (episode.duration ?? 0) <= 300;
                    if (isMiniNews) return <><Zap className="w-2.5 h-2.5" /> MINI-NEWS</>;
                    const style = CT_STYLE[ct] ?? CT_STYLE.movie;
                    const Icon = style.Icon;
                    return <><Icon className="w-2.5 h-2.5" /> {style.label}</>;
                  })()}
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onEditEpisode?.(episode)}
                  data-testid={`button-edit-${episode.id}`}
                >
                  <Edit className="w-4 h-4" />
                </Button>
              </div>
            </td>
          </>
          );
        }}
        components={{
          ...VirtuosoTableComponents,
          Scroller: forwardRef<HTMLDivElement, any>((props, ref) => <div {...props} ref={ref} className="overflow-auto" />),
          Table: (props) => <table {...props} style={{ ...props.style, width: '100%', minWidth: '1000px' }} />,
          TableRow: ({ style, item, ...props }) => {
            const row = item as FlatRow;
            // Season header rows get neutral styling
            if (row && "_isSeasonHeader" in row && row._isSeasonHeader) {
              return <tr {...props} style={style} className="border-b" />;
            }
            const ep = row as Episode;
            const borderColor =
              ep?.status === "valid" || ep?.status === "redirected"
                ? "border-l-green-500"
                : ep?.status === "warning"
                ? "border-l-yellow-500"
                : ep?.status === "invalid"
                ? "border-l-red-500"
                : ep?.status === "deriving" || ep?.status === "pending"
                ? "border-l-cyan-500"
                : "border-l-transparent";
            const tier = ep ? getContentTier(ep.duration ?? 0) : "full";
            const miniTint = tier === "mini" ? "bg-orange-500/5 dark:bg-orange-400/5" : "";
            return (
              <tr
                {...props}
                style={style}
                className={`border-b border-l-[3px] transition-colors hover:bg-muted/40 ${borderColor} ${miniTint}`}
              />
            );
          },
          TableFoot: () =>
            isFetchingMore ? (
              <tfoot>
                {Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b">
                    <td className="px-3 py-2.5"><Skeleton className="h-4 w-4 rounded" /></td>
                    <td className="px-2 py-2.5"><Skeleton className="h-10 w-16 rounded" /></td>
                    <td className="px-2 py-2.5"><Skeleton className="h-5 w-12 rounded-full" /></td>
                    <td className="px-2 py-2.5"><Skeleton className="h-5 w-12 rounded-full" /></td>
                    <td className="px-2 py-2.5"><Skeleton className="h-3 w-48" /></td>
                    <td className="px-2 py-2.5"><Skeleton className="h-5 w-20 rounded-full" /></td>
                    <td className="px-2 py-2.5"><Skeleton className="h-3 w-10" /></td>
                    <td className="px-2 py-2.5"><Skeleton className="h-4 w-4 rounded-full" /></td>
                    <td className="px-2 py-2.5"><Skeleton className="h-8 w-8 rounded-md" /></td>
                  </tr>
                ))}
              </tfoot>
            ) : null,
        }}
      />
    </div>
  );
}
