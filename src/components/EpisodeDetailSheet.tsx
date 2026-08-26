import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/src/components/ui/sheet";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { ExternalLink, Copy, ChevronUp, ChevronDown, Pencil } from "lucide-react";
import type { Episode } from "@shared/schema";
import { useToast } from "@/src/hooks/use-toast";

interface EpisodeDetailSheetProps {
  episode: Episode | null;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
  onEdit?: (episode: Episode) => void;
}

export function EpisodeDetailSheet({
  episode,
  onClose,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
  onEdit,
}: EpisodeDetailSheetProps) {
  const { toast } = useToast();

  if (!episode) return null;

  const statusVariant =
    episode.status === "valid"
      ? "default"
      : episode.status === "warning"
        ? "secondary"
        : "destructive";

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(episode.url);
      toast({ title: "Copied", description: "URL copied to clipboard" });
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  return (
    <Sheet open={!!episode} onOpenChange={onClose}>
      <SheetContent
        className="w-[420px] sm:w-[480px] overflow-y-auto"
        side="right"
      >
        <SheetHeader className="pb-4 border-b">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <SheetTitle className="text-sm font-medium truncate flex-1 min-w-0">
              {episode.title}
            </SheetTitle>
            <div className="flex gap-1 flex-shrink-0">
              <Button
                size="icon"
                variant="ghost"
                onClick={onPrev}
                disabled={!hasPrev}
                data-testid="button-detail-prev"
              >
                <ChevronUp className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={onNext}
                disabled={!hasNext}
                data-testid="button-detail-next"
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
              {onEdit && (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => { onClose(); onEdit(episode); }}
                  data-testid="button-detail-edit"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-5 pt-4 text-sm">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <span className="text-xs text-muted-foreground block mb-1">
                Season
              </span>
              <p className="font-mono font-medium">
                {String(episode.season).padStart(2, "0")}
              </p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground block mb-1">
                Episode
              </span>
              <p className="font-mono font-medium">
                {String(episode.episode).padStart(2, "0")}
              </p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground block mb-1">
                Status
              </span>
              <Badge variant={statusVariant} className="mt-0.5">
                {episode.status}
              </Badge>
            </div>
          </div>

          {episode.groupTitle && (
            <div>
              <span className="text-xs text-muted-foreground block mb-1">
                Group
              </span>
              <p className="font-medium">{episode.groupTitle}</p>
            </div>
          )}

          {episode.duration > 0 && (
            <div>
              <span className="text-xs text-muted-foreground block mb-1">
                Duration
              </span>
              <p className="font-mono">
                {Math.floor(episode.duration / 60)}m {episode.duration % 60}s
              </p>
            </div>
          )}

          <div>
            <span className="text-xs text-muted-foreground block mb-1">
              URL
            </span>
            <div className="flex items-start gap-2 mt-1">
              <p className="font-mono text-xs break-all flex-1 text-muted-foreground leading-relaxed">
                {episode.url}
              </p>
              <div className="flex gap-1 flex-shrink-0">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={copyUrl}
                  data-testid="button-detail-copy-url"
                >
                  <Copy className="h-3 w-3" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => window.open(episode.url, "_blank")}
                  data-testid="button-detail-open-url"
                >
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>

          {(episode.tvgId || episode.tvgName || episode.tvgLogo) && (
            <div className="space-y-1.5">
              <span className="text-xs text-muted-foreground block">
                EPG Metadata
              </span>
              <div className="bg-muted rounded-md p-3 space-y-1">
                {episode.tvgId && (
                  <p className="font-mono text-xs">
                    <span className="text-muted-foreground">tvg-id: </span>
                    {episode.tvgId}
                  </p>
                )}
                {episode.tvgName && (
                  <p className="font-mono text-xs">
                    <span className="text-muted-foreground">tvg-name: </span>
                    {episode.tvgName}
                  </p>
                )}
                {episode.tvgLogo && (
                  <p className="font-mono text-xs break-all">
                    <span className="text-muted-foreground">tvg-logo: </span>
                    {episode.tvgLogo}
                  </p>
                )}
              </div>
            </div>
          )}

          {episode.validatedAt && (
            <div>
              <span className="text-xs text-muted-foreground block mb-1">
                URL Validation
              </span>
              <div className="bg-muted rounded-md p-3 space-y-1.5">
                <p className="text-xs">
                  <span className="text-muted-foreground">Last checked: </span>
                  {new Date(episode.validatedAt).toLocaleString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
                {episode.resolvedUrl && episode.resolvedUrl !== episode.url && (
                  <p className="font-mono text-xs break-all">
                    <span className="text-muted-foreground">Resolved to: </span>
                    <a
                      href={episode.resolvedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {episode.resolvedUrl}
                    </a>
                  </p>
                )}
              </div>
            </div>
          )}

          <div>
            <span className="text-xs text-muted-foreground block mb-1">
              Raw JSON
            </span>
            <pre className="p-3 bg-muted rounded-md text-xs overflow-x-auto whitespace-pre-wrap leading-relaxed">
              {JSON.stringify(episode, null, 2)}
            </pre>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
