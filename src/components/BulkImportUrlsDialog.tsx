import { useState, useRef, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/src/lib/queryClient";
import { useToast } from "@/src/hooks/use-toast";
import { buildWeeblyHtml, buildM3U, type ExportEpisode } from "@/src/lib/clientExport";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/src/components/ui/dialog";
import { Button } from "@/src/components/ui/button";
import { Switch } from "@/src/components/ui/switch";
import { Label } from "@/src/components/ui/label";
import { Input } from "@/src/components/ui/input";
import { Badge } from "@/src/components/ui/badge";
import { ScrollArea } from "@/src/components/ui/scroll-area";
import {
  Upload,
  FileText,
  Download,
  Tv,
  Loader2,
  Link2,
  Trash2,
  FolderOpen,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface HarvestedItem {
  url: string;
  title: string;
}

// ─── Harvest logic (all in-memory, bloat discarded immediately) ───────────────

const VIDEO_EXT_RE = /\.(mp4|m3u8?|ts|mkv|webm|mov|avi|m4v|ogv|flv|wmv|mpg|mpeg|divx)(\?[^"'\s]*)?$/i;
const ARCHIVE_RE = /https?:\/\/(?:archive\.org|ia\d+\.us\.archive\.org)\//i;
const URL_RE = /https?:\/\/[^\s"'<>()]+/gi;

function titleFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const last = pathname.split("/").filter(Boolean).pop() || "";
    return decodeURIComponent(last.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ")).trim() || url;
  } catch {
    return url;
  }
}

function isKeepable(url: string): boolean {
  return VIDEO_EXT_RE.test(url) || ARCHIVE_RE.test(url);
}

function harvestLinks(rawText: string, fileName: string): HarvestedItem[] {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  const seen = new Set<string>();
  const items: HarvestedItem[] = [];

  function add(url: string, title?: string) {
    const clean = url.trim().replace(/[,;'"]+$/, "");
    if (!clean.startsWith("http") || seen.has(clean)) return;
    if (!isKeepable(clean)) return;
    seen.add(clean);
    items.push({ url: clean, title: (title?.trim() || titleFromUrl(clean)).slice(0, 200) });
  }

  // ── JSON ──────────────────────────────────────────────────────────────────
  if (ext === "json") {
    try {
      const parsed = JSON.parse(rawText);
      const arr: any[] = Array.isArray(parsed) ? parsed
        : parsed.episodes ?? parsed.items ?? parsed.playlist ?? parsed.links ?? [];
      for (const item of arr) {
        if (typeof item === "string") add(item);
        else if (item && typeof item === "object") {
          const url = item.url ?? item.src ?? item.link ?? item.href ?? item.stream ?? "";
          const title = item.title ?? item.name ?? item.label ?? "";
          if (url) add(url, title);
        }
      }
      // also regex-scan for any leftover URLs in case structure was different
      const extra = rawText.match(URL_RE) ?? [];
      for (const u of extra) add(u);
      return items;
    } catch { /* fall through to regex */ }
  }

  // ── M3U / M3U8 ────────────────────────────────────────────────────────────
  if (ext === "m3u" || ext === "m3u8") {
    const lines = rawText.split(/\r?\n/);
    let pendingTitle = "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("#EXTINF")) {
        const comma = trimmed.indexOf(",");
        pendingTitle = comma >= 0 ? trimmed.slice(comma + 1).trim() : "";
      } else if (trimmed.startsWith("http")) {
        add(trimmed, pendingTitle || undefined);
        pendingTitle = "";
      } else {
        pendingTitle = "";
      }
    }
    return items;
  }

  // ── HTML / TXT — regex scan ───────────────────────────────────────────────
  const matches = rawText.match(URL_RE) ?? [];
  for (const u of matches) add(u);
  return items;
}

// ─── Download helper ──────────────────────────────────────────────────────────

function triggerDownload(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
}

// ─── Component ────────────────────────────────────────────────────────────────

interface BulkImportUrlsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportAndPlay?: (url: string) => void;
}

export function BulkImportUrlsDialog({ open, onOpenChange, onImportAndPlay }: BulkImportUrlsDialogProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [harvested, setHarvested] = useState<HarvestedItem[]>([]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [groupTitle, setGroupTitle] = useState("");
  const [loadedFileName, setLoadedFileName] = useState("");
  const [includeNonVideo, setIncludeNonVideo] = useState(false);

  function reset() {
    setHarvested([]);
    setLoadedFileName("");
    setGroupTitle("");
  }

  function processFile(file: File) {
    const reader = new FileReader();
    reader.onload = (evt) => {
      const raw = evt.target?.result as string ?? "";
      const items = harvestLinks(raw, file.name);
      setHarvested(items);
      setLoadedFileName(file.name);
      if (items.length === 0) {
        toast({ title: "No video links found", description: "The file had no recognisable video URLs.", variant: "destructive" });
      } else {
        toast({ title: `Harvested ${items.length} link${items.length !== 1 ? "s" : ""}`, description: `From: ${file.name}` });
      }
    };
    reader.readAsText(file);
  }

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, []);

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = "";
  }

  const importMutation = useMutation({
    mutationFn: async (playAfter: boolean = false): Promise<{ created: number; skipped: number; playAfter: boolean }> => {
      const resp = await apiRequest("POST", "/api/episodes/import-urls", {
        urls: harvested.map(h => h.url),
        groupTitle: groupTitle.trim() || undefined,
        includeNonVideo,
      });
      const data = await resp.json();
      return { ...data, playAfter };
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/episodes"] });
      toast({
        title: "Import complete",
        description: `${data?.created ?? 0} imported, ${data?.skipped ?? 0} skipped.`,
      });
      if (data.playAfter && onImportAndPlay && harvested.length > 0) {
        onImportAndPlay(harvested[0].url);
      }
      onOpenChange(false);
      reset();
    },
    onError: (error: any) => {
      toast({ title: "Import failed", description: error?.message || "An unknown error occurred.", variant: "destructive" });
    },
  });

  function handleDownloadM3U() {
    if (!harvested.length) return;
    triggerDownload(buildM3U(harvested), "playlist.m3u", "text/plain");
    toast({ title: "Downloaded playlist.m3u", description: `${harvested.length} tracks` });
  }

  function handleDownloadWeebly() {
    if (!harvested.length) return;
    triggerDownload(buildWeeblyHtml(harvested.map((item) => ({ title: item.title, url: item.url, duration: 300 } as ExportEpisode)), "TV Player"), "tv-player.html", "text/html");
    toast({ title: "Downloaded tv-player.html", description: `${harvested.length} tracks — single-player broadcast engine` });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Link2 className="w-4 h-4 text-cyan-400" />
            Universal Import
          </DialogTitle>
          <DialogDescription className="text-xs">
            Load a <strong>.json</strong>, <strong>.m3u</strong>, <strong>.txt</strong>, or <strong>.html</strong> file.
            Video links are harvested automatically — titles, URLs, nothing else is kept in memory.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-auto px-6 py-4 space-y-4">

          {/* ── Drop zone ── */}
          <div
            className={`relative rounded-md border-2 border-dashed transition-colors ${
              isDraggingOver ? "border-cyan-400 bg-cyan-400/5" : "border-border hover:border-primary/50"
            }`}
            onDragOver={e => { e.preventDefault(); setIsDraggingOver(true); }}
            onDragLeave={() => setIsDraggingOver(false)}
            onDrop={handleDrop}
          >
            <div className="flex flex-col items-center justify-center gap-3 py-10 text-center cursor-pointer select-none" onClick={() => fileInputRef.current?.click()}>
              <FolderOpen className="w-10 h-10 text-muted-foreground/50" />
              <div>
                <p className="text-sm font-medium">Drop a file here or click to browse</p>
                <p className="text-xs text-muted-foreground mt-0.5">Accepts .json · .m3u · .m3u8 · .txt · .html</p>
              </div>
              <Button variant="outline" size="sm" onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }} data-testid="button-universal-browse">
                <Upload className="w-3.5 h-3.5 mr-1.5" />
                Browse file
              </Button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.m3u,.m3u8,.txt,.html,.htm,text/plain,text/html,application/json"
              className="hidden"
              onChange={handleFileInput}
              data-testid="input-universal-file"
            />
          </div>

          {/* ── Workspace ── */}
          {harvested.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-cyan-400 uppercase tracking-widest">
                  Temp Workspace — {harvested.length} link{harvested.length !== 1 ? "s" : ""} from {loadedFileName}
                </p>
                <Button variant="ghost" size="sm" onClick={reset} className="text-muted-foreground h-6 px-2" data-testid="button-workspace-clear">
                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                  Clear
                </Button>
              </div>
              <ScrollArea className="h-[220px] rounded-md border bg-muted/20">
                <div className="p-2 space-y-1">
                  {harvested.map((item, i) => (
                    <div key={i} className="flex items-start gap-2 rounded px-2 py-1.5 text-xs hover-elevate" data-testid={`harvest-row-${i}`}>
                      <span className="shrink-0 font-mono text-muted-foreground/60 w-5 text-right">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate text-foreground/90">{item.title}</p>
                        <p className="font-mono truncate text-muted-foreground/70">{item.url}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              {/* ── Quick export buttons ── */}
              <div className="flex items-center gap-2 flex-wrap pt-1">
                <Button variant="secondary" size="sm" onClick={handleDownloadM3U} data-testid="button-download-m3u">
                  <Download className="w-3.5 h-3.5 mr-1.5 text-green-500" />
                  Download M3U
                </Button>
                <Button variant="secondary" size="sm" onClick={handleDownloadWeebly} data-testid="button-download-weebly">
                  <Tv className="w-3.5 h-3.5 mr-1.5 text-purple-400" />
                  Download Weebly HTML
                </Button>
              </div>
            </div>
          )}

          {/* ── Import to library options ── */}
          {harvested.length > 0 && (
            <div className="space-y-3 border-t pt-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Import to Library</p>
              <div className="space-y-1.5">
                <Label htmlFor="bulk-group" className="text-xs text-muted-foreground">Group tag (optional)</Label>
                <Input
                  id="bulk-group"
                  placeholder="e.g. My Videos"
                  value={groupTitle}
                  onChange={e => setGroupTitle(e.target.value)}
                  className="h-8 text-sm"
                  data-testid="input-bulk-group"
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="include-non-video"
                  checked={includeNonVideo}
                  onCheckedChange={setIncludeNonVideo}
                  data-testid="switch-include-non-video"
                />
                <Label htmlFor="include-non-video" className="text-sm cursor-pointer">Include non-video files</Label>
                {includeNonVideo && <span className="text-xs text-amber-400 ml-1">(marked as not playable)</span>}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="px-6 py-4 border-t shrink-0 gap-2">
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }} data-testid="button-bulk-cancel">
            Cancel
          </Button>
          {harvested.length > 0 && (
            <>
              {onImportAndPlay && (
                <Button
                  onClick={() => importMutation.mutate(true)}
                  disabled={importMutation.isPending}
                  variant="secondary"
                  data-testid="button-bulk-import-play"
                >
                  <Tv className="w-3.5 h-3.5 mr-1.5" />
                  Import & Play {harvested.length === 1 ? '1' : 'First'}
                </Button>
              )}
              <Button
                onClick={() => importMutation.mutate(false)}
                disabled={importMutation.isPending}
                data-testid="button-bulk-import"
              >
                {importMutation.isPending ? (
                  <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Importing…</>
                ) : (
                  <><Upload className="w-3.5 h-3.5 mr-1.5" />Import {harvested.length} to Library</>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
