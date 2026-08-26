import { useState, useMemo } from "react";
import { Eraser, AlertCircle, Loader2, Wand2, RefreshCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/src/components/ui/dialog";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Switch } from "@/src/components/ui/switch";
import { Badge } from "@/src/components/ui/badge";
import { useToast } from "@/src/hooks/use-toast";
import { apiRequest } from "@/src/lib/queryClient";
import { queryClient } from "@/src/lib/queryClient";
import type { Episode } from "@shared/schema";

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function applyClean(title: string, re: RegExp, replacement: string): string {
  return title.replace(re, replacement).replace(/\s{2,}/g, " ").trim();
}

interface RemasterPreview {
  id: string;
  original: string;
  remastered: string;
}

interface BulkCleanTitlesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedEpisodes: Episode[];
  onApplied?: () => void;
}

export default function BulkCleanTitlesDialog({
  open,
  onOpenChange,
  selectedEpisodes,
  onApplied,
}: BulkCleanTitlesDialogProps) {
  const { toast } = useToast();

  // ── regex mode ────────────────────────────────────────────────────────────
  const [pattern, setPattern] = useState("");
  const [replacement, setReplacement] = useState("");
  const [isRegex, setIsRegex] = useState(false);
  const [flags, setFlags] = useState("gi");
  const [regexError, setRegexError] = useState<string | null>(null);

  // ── shared ────────────────────────────────────────────────────────────────
  const [remasterMode, setRemasterMode] = useState(false);
  const [applying, setApplying] = useState(false);

  // ── remaster mode ─────────────────────────────────────────────────────────
  const [remasterPreviews, setRemasterPreviews] = useState<RemasterPreview[]>([]);
  const [remasterLoading, setRemasterLoading] = useState(false);
  const [remasterError, setRemasterError] = useState<string | null>(null);
  const [remasterScanned, setRemasterScanned] = useState(false);

  // ── regex preview (client-side, instant) ─────────────────────────────────
  const regexPreview = useMemo(() => {
    setRegexError(null);
    if (!pattern) {
      return selectedEpisodes.map((ep) => ({
        id: ep.id,
        original: ep.title,
        cleaned: ep.title,
        changed: false,
      }));
    }
    try {
      const rawPattern = isRegex ? pattern : escapeRegex(pattern);
      const re = new RegExp(rawPattern, flags);
      return selectedEpisodes.map((ep) => {
        const cleaned = applyClean(ep.title, re, replacement);
        return {
          id: ep.id,
          original: ep.title,
          cleaned: cleaned || ep.title,
          changed: cleaned !== ep.title && !!cleaned,
        };
      });
    } catch (e: any) {
      setRegexError(e.message || "Invalid pattern");
      return selectedEpisodes.map((ep) => ({
        id: ep.id,
        original: ep.title,
        cleaned: ep.title,
        changed: false,
      }));
    }
  }, [pattern, replacement, isRegex, flags, selectedEpisodes]);

  const regexChangedCount = regexPreview.filter((p) => p.changed).length;

  // ── remaster scan (triggered by button, not useEffect) ───────────────────
  async function runRemasterScan() {
    setRemasterLoading(true);
    setRemasterPreviews([]);
    setRemasterError(null);
    setRemasterScanned(false);
    try {
      const res = await apiRequest("POST", "/api/episodes/bulk-remaster-titles", {
        ids: selectedEpisodes.map((e) => e.id),
        dryRun: true,
      });
      const data: { previews: RemasterPreview[] } = await res.json();
      setRemasterPreviews(data.previews ?? []);
      setRemasterScanned(true);
    } catch (err: any) {
      setRemasterError(err.message || "Scan failed — check server logs");
      setRemasterScanned(true);
    } finally {
      setRemasterLoading(false);
    }
  }

  // Switch to remaster mode and immediately kick off the scan
  function enterRemasterMode() {
    setRemasterMode(true);
    setRemasterScanned(false);
    setRemasterPreviews([]);
    setRemasterError(null);
    runRemasterScan();
  }

  // ── handlers ──────────────────────────────────────────────────────────────
  const handleApplyRegex = async () => {
    if (!pattern || regexError || regexChangedCount === 0) return;
    setApplying(true);
    try {
      const apiPattern = isRegex ? pattern : escapeRegex(pattern);
      await apiRequest("POST", "/api/episodes/bulk-clean-titles", {
        ids: selectedEpisodes.map((e) => e.id),
        pattern: apiPattern,
        flags,
        replacement,
      });
      await queryClient.invalidateQueries({ queryKey: ["/api/episodes"] });
      toast({ title: `Cleaned ${regexChangedCount} title(s) successfully` });
      onApplied?.();
      onOpenChange(false);
      setPattern("");
      setReplacement("");
    } catch (err: any) {
      toast({
        title: "Clean failed",
        description: err.message || "Could not apply title cleaning",
        variant: "destructive",
      });
    } finally {
      setApplying(false);
    }
  };

  const handleApplyRemaster = async () => {
    if (remasterPreviews.length === 0) return;
    setApplying(true);
    try {
      const res = await apiRequest("POST", "/api/episodes/bulk-remaster-titles", {
        ids: remasterPreviews.map((p) => p.id),
        dryRun: false,
      });
      const data: { changed: number } = await res.json();
      await queryClient.invalidateQueries({ queryKey: ["/api/episodes"] });
      toast({ title: `Remastered ${data.changed} title(s) successfully` });
      onApplied?.();
      onOpenChange(false);
    } catch (err: any) {
      toast({
        title: "Remaster failed",
        description: err.message || "Could not apply remastered titles",
        variant: "destructive",
      });
    } finally {
      setApplying(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    // Reset all state on close so next open is fresh
    setTimeout(() => {
      setRemasterMode(false);
      setRemasterPreviews([]);
      setRemasterError(null);
      setRemasterScanned(false);
      setPattern("");
      setReplacement("");
    }, 150);
  };

  // ── derived ───────────────────────────────────────────────────────────────
  const remasterChangedCount = remasterPreviews.length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl" data-testid="dialog-bulk-clean-titles">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {remasterMode ? <Wand2 className="w-4 h-4" /> : <Eraser className="w-4 h-4" />}
            {remasterMode ? "Auto-Remaster Titles" : "Bulk Clean Titles"}
          </DialogTitle>
          <DialogDescription>
            {remasterMode
              ? `Mines Archive.org download URLs to generate clean titles for ${selectedEpisodes.length} selected episode(s). Preview before committing.`
              : `Remove or replace a pattern from ${selectedEpisodes.length} selected episode title(s). Preview before committing.`}
          </DialogDescription>
        </DialogHeader>

        {/* Mode toggle */}
        <div className="flex items-center gap-2 border rounded-md px-3 py-2">
          <Button
            size="sm"
            variant={!remasterMode ? "secondary" : "ghost"}
            onClick={() => setRemasterMode(false)}
            disabled={applying}
            data-testid="button-mode-regex"
          >
            <Eraser className="w-3 h-3 mr-1.5" />
            Pattern
          </Button>
          <Button
            size="sm"
            variant={remasterMode ? "secondary" : "ghost"}
            onClick={enterRemasterMode}
            disabled={applying || remasterLoading}
            data-testid="button-mode-remaster"
          >
            <Wand2 className="w-3 h-3 mr-1.5" />
            Auto-Remaster
          </Button>
        </div>

        <div className="space-y-4 py-2">

          {/* ── Pattern mode inputs ── */}
          {!remasterMode && (
            <>
              <div className="flex items-center gap-4 border rounded-md px-3 py-2">
                <label className="flex items-center gap-2 cursor-pointer" htmlFor="switch-is-regex">
                  <Switch
                    id="switch-is-regex"
                    checked={isRegex}
                    onCheckedChange={setIsRegex}
                    data-testid="switch-is-regex"
                  />
                  <span className="text-sm">Regex mode</span>
                </label>
                {isRegex && (
                  <div className="flex items-center gap-2 ml-auto">
                    <Label htmlFor="input-flags" className="text-xs text-muted-foreground">Flags:</Label>
                    <Input
                      id="input-flags"
                      value={flags}
                      onChange={(e) => setFlags(e.target.value)}
                      className="h-7 w-20 text-xs font-mono"
                      placeholder="gi"
                      data-testid="input-regex-flags"
                    />
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="input-pattern">
                    {isRegex ? "Regex pattern" : "String to remove"}
                  </Label>
                  <Input
                    id="input-pattern"
                    value={pattern}
                    onChange={(e) => setPattern(e.target.value)}
                    placeholder={isRegex ? "e.g. \\d{4}\\s*U\\.S\\.\\s*NAVY" : "e.g. 1944 U.S. NAVY"}
                    className="font-mono text-sm"
                    data-testid="input-clean-pattern"
                  />
                  {regexError && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {regexError}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="input-replacement">Replace with (empty = delete)</Label>
                  <Input
                    id="input-replacement"
                    value={replacement}
                    onChange={(e) => setReplacement(e.target.value)}
                    placeholder="Leave blank to remove"
                    className="font-mono text-sm"
                    data-testid="input-clean-replacement"
                  />
                </div>
              </div>
            </>
          )}

          {/* ── Remaster mode description ── */}
          {remasterMode && (
            <div className="text-xs text-muted-foreground border rounded-md px-3 py-2 space-y-1">
              <p>
                Each episode&apos;s stored URL is mined for an Archive.org download filename.
                Quality tags (1080p, HEVC, x265, etc.) and container extensions are stripped.
                Bare episode codes like <code className="font-mono">S01E01</code> or{" "}
                <code className="font-mono">1x01</code> are prefixed with the series folder name.
              </p>
              <p className="text-muted-foreground/70">
                Episodes with no archive.org URL, or whose mined title matches the current title, are skipped.
              </p>
            </div>
          )}

          {/* ── Preview table ── */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">
                {remasterMode
                  ? remasterLoading
                    ? "Scanning URLs…"
                    : `Preview (${remasterChangedCount} of ${selectedEpisodes.length} will change)`
                  : `Preview (${regexChangedCount} of ${selectedEpisodes.length} will change)`}
              </Label>
              <div className="flex items-center gap-2">
                {remasterMode && remasterScanned && !remasterLoading && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={runRemasterScan}
                    disabled={applying}
                    data-testid="button-rescan-remaster"
                  >
                    <RefreshCw className="w-3 h-3 mr-1" />
                    Re-scan
                  </Button>
                )}
                {(remasterMode ? remasterChangedCount : regexChangedCount) > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {remasterMode ? remasterChangedCount : regexChangedCount} change
                    {(remasterMode ? remasterChangedCount : regexChangedCount) !== 1 ? "s" : ""}
                  </Badge>
                )}
              </div>
            </div>

            <div className="border rounded-md overflow-hidden max-h-56 overflow-y-auto">
              {remasterMode ? (
                remasterLoading ? (
                  <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Scanning {selectedEpisodes.length} URLs…
                  </div>
                ) : remasterError ? (
                  <div className="flex items-center justify-center gap-2 py-8 text-sm text-destructive">
                    <AlertCircle className="w-4 h-4" />
                    {remasterError}
                  </div>
                ) : remasterPreviews.length === 0 ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    No archive.org URLs found in the selected episodes.
                  </div>
                ) : (
                  <table className="w-full text-xs">
                    <thead className="bg-muted/60 sticky top-0">
                      <tr>
                        <th className="px-3 py-1.5 text-left font-medium text-muted-foreground w-1/2">Original</th>
                        <th className="px-3 py-1.5 text-left font-medium text-muted-foreground w-1/2">Remastered</th>
                      </tr>
                    </thead>
                    <tbody>
                      {remasterPreviews.map((row) => (
                        <tr
                          key={row.id}
                          className="border-t bg-green-500/5"
                          data-testid={`preview-row-${row.id}`}
                        >
                          <td className="px-3 py-1.5 font-mono text-muted-foreground truncate max-w-0">
                            <span className="block truncate">{row.original}</span>
                          </td>
                          <td className="px-3 py-1.5 font-mono truncate max-w-0">
                            <span className="block truncate text-green-500 dark:text-green-400 font-medium">
                              {row.remastered}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              ) : (
                <table className="w-full text-xs">
                  <thead className="bg-muted/60 sticky top-0">
                    <tr>
                      <th className="px-3 py-1.5 text-left font-medium text-muted-foreground w-1/2">Original</th>
                      <th className="px-3 py-1.5 text-left font-medium text-muted-foreground w-1/2">Cleaned</th>
                    </tr>
                  </thead>
                  <tbody>
                    {regexPreview.map((row) => (
                      <tr
                        key={row.id}
                        className={`border-t ${row.changed ? "bg-green-500/5" : ""}`}
                        data-testid={`preview-row-${row.id}`}
                      >
                        <td className="px-3 py-1.5 font-mono text-muted-foreground truncate max-w-0">
                          <span className="block truncate">{row.original}</span>
                        </td>
                        <td className="px-3 py-1.5 font-mono truncate max-w-0">
                          <span className={`block truncate ${row.changed ? "text-green-500 dark:text-green-400 font-medium" : "text-muted-foreground"}`}>
                            {row.cleaned}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose} disabled={applying}>
            Cancel
          </Button>
          {remasterMode ? (
            <Button
              onClick={handleApplyRemaster}
              disabled={applying || remasterLoading || remasterChangedCount === 0}
              data-testid="button-apply-remaster"
            >
              {applying ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Applying…
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4 mr-2" />
                  Remaster {remasterChangedCount} title{remasterChangedCount !== 1 ? "s" : ""}
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={handleApplyRegex}
              disabled={applying || !pattern || !!regexError || regexChangedCount === 0}
              data-testid="button-apply-clean-titles"
            >
              {applying ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Applying…
                </>
              ) : (
                <>
                  <Eraser className="w-4 h-4 mr-2" />
                  Apply to {regexChangedCount} title{regexChangedCount !== 1 ? "s" : ""}
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
