import { Upload, FileText, X, FolderOpen } from "lucide-react";
import { useState } from "react";
import { Button } from "@/src/components/ui/button";
import { Checkbox } from "@/src/components/ui/checkbox";
import { Label } from "@/src/components/ui/label";

const VIDEO_ONLY_EXTS = ['.mp4', '.mkv', '.webm', '.ts', '.m4v', '.avi', '.mov', '.m2ts', '.mpg', '.mpeg'];
const PLAYLIST_EXTS   = ['.m3u', '.m3u8', '.json'];
const ALL_ACCEPTED    = [...VIDEO_ONLY_EXTS, ...PLAYLIST_EXTS];

export function isVideoFile(file: File) {
  const lower = file.name.toLowerCase();
  return VIDEO_ONLY_EXTS.some(ext => lower.endsWith(ext));
}

export function isPlaylistFile(file: File) {
  const lower = file.name.toLowerCase();
  return PLAYLIST_EXTS.some(ext => lower.endsWith(ext));
}

function isAccepted(file: File) {
  const lower = file.name.toLowerCase();
  return ALL_ACCEPTED.some(ext => lower.endsWith(ext));
}

interface FileUploadZoneProps {
  onFilesSelect?: (files: File[]) => void;
  fileName?: string;
  stats?: { total: number; valid: number };
  onClear?: () => void;
}

export default function FileUploadZone({ onFilesSelect, fileName, stats, onClear }: FileUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  const hasFile = !!fileName;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files).filter(isAccepted);
    if (files.length > 0) onFilesSelect?.(files);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).filter(isAccepted);
    if (files.length > 0) onFilesSelect?.(files);
    e.target.value = "";
  };

  const handleFolderInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only include top-level files (webkitRelativePath = "folder/file.mp4" has 1 slash).
    // Nested subfolder entries ("folder/sub/file.mp4") are excluded per MVP scope.
    const files = Array.from(e.target.files ?? []).filter(f => {
      if (!isVideoFile(f)) return false;
      const parts = (f as File & { webkitRelativePath?: string }).webkitRelativePath?.split('/') ?? [];
      return parts.length <= 2; // ["folder", "file.mp4"] or ["file.mp4"]
    });
    if (files.length > 0) onFilesSelect?.(files);
    e.target.value = "";
  };

  if (hasFile) {
    return (
      <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/50 border">
        <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate leading-tight">{fileName}</p>
          {stats && (
            <p className="text-xs text-muted-foreground leading-tight">
              {stats.total} eps · {stats.valid} valid
            </p>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClear}
          data-testid="button-clear-file"
          title="Clear file"
        >
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div
        className={`flex items-center gap-2 px-3 py-2 rounded-md border border-dashed cursor-pointer transition-colors ${
          isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => document.getElementById('file-input')?.click()}
        data-testid="dropzone-upload"
        title="Drop .m3u, .m3u8, .json, or video files here — or use Browse / Folder"
      >
        <Upload className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium leading-tight truncate">Drop files here</p>
          <p className="text-xs text-muted-foreground leading-tight">m3u · mp4 · mkv · folder</p>
        </div>
        <input
          type="file"
          accept=".m3u,.m3u8,.json,.mp4,.mkv,.webm,.ts,.m4v,.avi,.mov,.m2ts,.mpg,.mpeg"
          multiple
          onChange={handleFileInput}
          className="hidden"
          id="file-input"
        />
        <input
          type="file"
          // @ts-ignore webkitdirectory is a non-standard but widely-supported attribute
          webkitdirectory=""
          multiple
          onChange={handleFolderInput}
          className="hidden"
          id="folder-input"
        />
        <Button
          variant="secondary"
          size="sm"
          asChild
          data-testid="button-browse"
          onClick={(e) => e.stopPropagation()}
        >
          <label htmlFor="file-input" className="cursor-pointer">Browse</label>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          asChild
          data-testid="button-browse-folder"
          onClick={(e) => e.stopPropagation()}
          title="Browse folder"
        >
          <label htmlFor="folder-input" className="cursor-pointer flex items-center gap-1">
            <FolderOpen className="w-3.5 h-3.5" />
            <span>Browse Folder</span>
          </label>
        </Button>
      </div>
    </div>
  );
}
