import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Textarea } from "@/src/components/ui/textarea";
import type { Episode } from "@shared/schema";

function formatDuration(seconds: number) {
  if (!seconds || seconds === 0) return "";
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hours > 0) {
    return `${hours}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

interface EpisodeUpdate {
  id: string;
  season: number;
  episode: number;
  title: string;
  url: string;
  groupTitle: string;
  duration: number;
  objectPosition: "top" | "center" | "bottom" | null;
}

interface EditEpisodeDialogProps {
  episode?: Episode | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSave?: (update: EpisodeUpdate) => void;
  existingGroups?: string[];
}

export default function EditEpisodeDialog({
  episode,
  open = false,
  onOpenChange,
  onSave,
  existingGroups = [],
}: EditEpisodeDialogProps) {
  const [season, setSeason] = useState(episode?.season || 1);
  const [episodeNum, setEpisodeNum] = useState(episode?.episode || 1);
  const [title, setTitle] = useState(episode?.title || "");
  const [url, setUrl] = useState(episode?.url || "");
  const [groupTitle, setGroupTitle] = useState(episode?.groupTitle || "");
  const [duration, setDuration] = useState(episode?.duration || 0);
  const [objectPosition, setObjectPosition] = useState<"top" | "center" | "bottom" | null>(
    (episode?.objectPosition as "top" | "center" | "bottom" | null) ?? null
  );

  useEffect(() => {
    if (episode) {
      setSeason(episode.season);
      setEpisodeNum(episode.episode);
      setTitle(episode.title);
      setUrl(episode.url);
      setGroupTitle(episode.groupTitle || "");
      setDuration(episode.duration || 0);
      setObjectPosition((episode.objectPosition as "top" | "center" | "bottom" | null) ?? null);
    }
  }, [episode]);

  const handleSave = () => {
    if (episode) {
      onSave?.({
        id: episode.id,
        season,
        episode: episodeNum,
        title,
        url,
        groupTitle,
        duration,
        objectPosition,
      });
    }
    onOpenChange?.(false);
  };

  const durationPreview = formatDuration(duration);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" data-testid="dialog-edit-episode">
        <DialogHeader>
          <DialogTitle>Edit Episode</DialogTitle>
          <DialogDescription>
            Update episode information and metadata
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <Label htmlFor="season" className="text-sm font-medium">
                Season
              </Label>
              <Input
                id="season"
                type="number"
                min="1"
                value={season}
                onChange={(e) => setSeason(parseInt(e.target.value) || 1)}
                className="mt-1"
                data-testid="input-season"
              />
            </div>
            <div className="flex-1">
              <Label htmlFor="episode" className="text-sm font-medium">
                Episode
              </Label>
              <Input
                id="episode"
                type="number"
                min="1"
                value={episodeNum}
                onChange={(e) => setEpisodeNum(parseInt(e.target.value) || 1)}
                className="mt-1"
                data-testid="input-episode"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="title" className="text-sm font-medium">
              Title
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1"
              placeholder="Episode title"
              data-testid="input-title"
            />
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <Label htmlFor="group-title" className="text-sm font-medium">
                Group
              </Label>
              <Input
                id="group-title"
                list="group-suggestions"
                value={groupTitle}
                onChange={(e) => setGroupTitle(e.target.value)}
                className="mt-1"
                placeholder="e.g. Movies"
                data-testid="input-group-title"
              />
              {existingGroups.length > 0 && (
                <datalist id="group-suggestions">
                  {existingGroups.map((g) => (
                    <option key={g} value={g} />
                  ))}
                </datalist>
              )}
            </div>
            <div className="flex-1">
              <Label htmlFor="duration" className="text-sm font-medium">
                Duration
                {durationPreview && (
                  <span className="ml-2 text-xs text-muted-foreground font-mono">
                    {durationPreview}
                  </span>
                )}
              </Label>
              <Input
                id="duration"
                type="number"
                min="0"
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value) || 0)}
                className="mt-1"
                placeholder="Seconds"
                data-testid="input-duration"
              />
            </div>
          </div>

          <div>
            <Label className="text-sm font-medium">Frame Position</Label>
            <div className="flex gap-1 mt-1" data-testid="toggle-object-position">
              {(["top", "center", "bottom"] as const).map((pos) => (
                <button
                  key={pos}
                  type="button"
                  onClick={() => setObjectPosition(objectPosition === pos ? null : pos)}
                  data-testid={`button-position-${pos}`}
                  className={[
                    "flex-1 px-3 py-1.5 text-sm font-medium rounded-md border transition-colors capitalize",
                    objectPosition === pos || (objectPosition === null && pos === "center")
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground border-input hover:bg-accent hover:text-accent-foreground",
                  ].join(" ")}
                >
                  {pos}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Controls which part of the frame is shown when the video is cropped in cover mode.
            </p>
          </div>

          <div>
            <Label htmlFor="url" className="text-sm font-medium">
              URL
            </Label>
            <Textarea
              id="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="mt-1 font-mono text-sm h-20"
              placeholder="https://..."
              data-testid="input-url"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange?.(false)}
            data-testid="button-cancel"
          >
            Cancel
          </Button>
          <Button onClick={handleSave} data-testid="button-save">
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
