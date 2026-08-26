import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/src/components/ui/button";
import { Badge } from "@/src/components/ui/badge";
import { Checkbox } from "@/src/components/ui/checkbox";
import { Label } from "@/src/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import { ScrollArea } from "@/src/components/ui/scroll-area";
import { Trash2, Copy, AlertCircle, Merge } from "lucide-react";
import { useState, useEffect } from "react";
import type { Episode } from "@shared/schema";
import { apiRequest } from "@/src/lib/queryClient";
import { useToast } from "@/src/hooks/use-toast";

interface DuplicatesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleteDuplicates: (ids: string[]) => void;
}

interface DuplicatesData {
  urlDuplicates: string[][];
  titleDuplicates: string[][];
  hostFilenameDuplicates: string[][];
  episodesMap: Record<string, Episode>;
  totalUrlDuplicates: number;
  totalTitleDuplicates: number;
  totalHostFilenameDuplicates: number;
}

function scoreCompleteness(ep: Episode): number {
  let score = 0;
  if (ep.thumbnailUrl) score++;
  if (ep.tvgId) score++;
  if (ep.tvgName) score++;
  if (ep.tvgLogo) score++;
  if (ep.groupTitle) score++;
  return score;
}

function pickKeeper(
  group: string[],
  episodesMap: Record<string, Episode>,
  strategy: "newest" | "oldest" | "longest" | "mostComplete"
): string | null {
  const eps = group.map((id) => episodesMap[id]).filter(Boolean);
  if (eps.length === 0) return null;

  let best = eps[0];
  for (const ep of eps.slice(1)) {
    if (strategy === "newest") {
      if (new Date(ep.importedAt) > new Date(best.importedAt)) best = ep;
    } else if (strategy === "oldest") {
      if (new Date(ep.importedAt) < new Date(best.importedAt)) best = ep;
    } else if (strategy === "longest") {
      if ((ep.duration ?? 0) > (best.duration ?? 0)) best = ep;
    } else {
      if (scoreCompleteness(ep) > scoreCompleteness(best)) best = ep;
    }
  }
  const allSame = eps.every((ep) => {
    if (strategy === "newest" || strategy === "oldest")
      return ep.importedAt === best.importedAt;
    if (strategy === "longest") return ep.duration === best.duration;
    return scoreCompleteness(ep) === scoreCompleteness(best);
  });
  return allSame && eps.length > 1 ? null : best.id;
}

function DuplicateGroup({
  group,
  label,
  colorClass,
  index,
  episodesMap,
  selectedDuplicates,
  onToggle,
  onAutoSelect,
  onMerge,
}: {
  group: string[];
  label: string;
  colorClass: string;
  index: number;
  episodesMap: Record<string, Episode>;
  selectedDuplicates: string[];
  onToggle: (id: string) => void;
  onAutoSelect: (keepId: string, group: string[]) => void;
  onMerge: (keepId: string, group: string[]) => void;
}) {
  const strategies: Array<{
    key: "newest" | "oldest" | "longest" | "mostComplete";
    label: string;
  }> = [
    { key: "newest", label: "Keep Newest" },
    { key: "oldest", label: "Keep Oldest" },
    { key: "longest", label: "Keep Longest" },
    { key: "mostComplete", label: "Keep Most Complete" },
  ];

  return (
    <div className="border rounded-md p-3 space-y-2">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h4 className={`text-sm font-semibold ${colorClass}`}>
          {label} {index + 1}
        </h4>
        <div className="flex flex-wrap gap-1">
          {strategies.map(({ key, label: btnLabel }) => {
            const keeperId = pickKeeper(group, episodesMap, key);
            return (
              <Button
                key={key}
                variant="outline"
                size="sm"
                disabled={keeperId === null}
                title={keeperId === null ? "All entries have identical values" : undefined}
                onClick={() => keeperId && onAutoSelect(keeperId, group)}
                data-testid={`button-${key}-${index}`}
              >
                {btnLabel}
              </Button>
            );
          })}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const keeperId = pickKeeper(group, episodesMap, "mostComplete");
              if (keeperId) onMerge(keeperId, group);
            }}
            data-testid={`button-merge-${index}`}
          >
            <Merge className="w-3 h-3 mr-1" />
            Merge & Keep
          </Button>
        </div>
      </div>

      <div className="space-y-1.5">
        {group.map((id, j) => {
          const ep = episodesMap[id];
          if (!ep) return null;
          const isSelected = selectedDuplicates.includes(id);
          return (
            <div
              key={id}
              className={`flex items-center gap-2 text-sm p-1.5 rounded-md transition-colors ${isSelected ? "bg-destructive/10" : ""}`}
            >
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => onToggle(id)}
                data-testid={`checkbox-duplicate-${id}`}
              />
              <span className="font-mono text-xs text-muted-foreground w-28 truncate shrink-0">
                {id}
              </span>
              <span className="truncate flex-1">{ep.title}</span>
              <span className="text-xs text-muted-foreground shrink-0">
                {ep.duration ? `${Math.round(ep.duration / 60)}m` : "—"}
              </span>
              {j === 0 && (
                <Badge variant="secondary" className="text-xs shrink-0">
                  First
                </Badge>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function DuplicatesDialog({
  open,
  onOpenChange,
  onDeleteDuplicates,
}: DuplicatesDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedDuplicates, setSelectedDuplicates] = useState<string[]>([]);
  const [mergeOverwrite, setMergeOverwrite] = useState(false);

  const { data: duplicates, isLoading } = useQuery<DuplicatesData>({
    queryKey: ["/api/episodes/duplicates"],
    staleTime: 60000,
    retry: 1,
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/episodes/duplicates");
      return res.json();
    },
    enabled: open,
  });

  useEffect(() => {
    if (!open) setSelectedDuplicates([]);
  }, [open]);

  const episodesMap = duplicates?.episodesMap ?? {};

  const mergeMutation = useMutation({
    mutationFn: (body: { keepId: string; deleteIds: string[]; overwrite: boolean }) =>
      apiRequest("POST", "/api/episodes/merge", body),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/episodes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/episodes/duplicates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/episodes/stats"] });
      toast({
        title: "Merged",
        description: `Kept 1 episode, deleted ${vars.deleteIds.length} duplicate${vars.deleteIds.length !== 1 ? "s" : ""}`,
      });
      onOpenChange(false);
    },
    onError: () =>
      toast({ title: "Merge failed", description: "Could not merge episodes", variant: "destructive" }),
  });

  const toggleDuplicate = (id: string) => {
    setSelectedDuplicates((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const autoSelectForGroup = (keeperId: string, group: string[]) => {
    const toDelete = group.filter((id) => id !== keeperId);
    setSelectedDuplicates((prev) => {
      const updated = [...prev];
      for (const id of toDelete) {
        if (!updated.includes(id)) updated.push(id);
      }
      for (const id of group) {
        if (id === keeperId) {
          const idx = updated.indexOf(id);
          if (idx !== -1) updated.splice(idx, 1);
        }
      }
      return updated;
    });
  };

  const selectAllExceptFirst = () => {
    const toSelect: string[] = [];
    const addGroup = (group: string[]) =>
      group.slice(1).forEach((id) => {
        if (!toSelect.includes(id)) toSelect.push(id);
      });
    duplicates?.urlDuplicates.forEach(addGroup);
    duplicates?.titleDuplicates.forEach(addGroup);
    duplicates?.hostFilenameDuplicates.forEach(addGroup);
    setSelectedDuplicates(toSelect);
  };

  const handleDelete = () => {
    onDeleteDuplicates(selectedDuplicates);
    queryClient.invalidateQueries({ queryKey: ["/api/episodes/duplicates"] });
    onOpenChange(false);
  };

  const handleMerge = (keepId: string, group: string[]) => {
    const deleteIds = group.filter((id) => id !== keepId);
    if (deleteIds.length === 0) return;
    mergeMutation.mutate({ keepId, deleteIds, overwrite: mergeOverwrite });
  };

  const urlDups = duplicates?.urlDuplicates ?? [];
  const titleDups = (duplicates?.titleDuplicates ?? []).filter(
    (group) =>
      !urlDups.some(
        (ug) => ug.length === group.length && ug.every((id, i) => id === group[i])
      )
  );
  const hostFileDups = (duplicates?.hostFilenameDuplicates ?? []).filter(
    (group) =>
      !urlDups.some(
        (ug) => ug.length === group.length && ug.every((id, i) => id === group[i])
      )
  );

  const hasDuplicates = urlDups.length > 0 || titleDups.length > 0 || hostFileDups.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="w-5 h-5" />
            Duplicate Detection
          </DialogTitle>
          <DialogDescription>
            Use auto-resolution buttons per group, or select manually then delete.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground">Scanning for duplicates…</div>
        ) : !hasDuplicates ? (
          <div className="py-8 text-center text-muted-foreground flex flex-col items-center gap-2">
            <AlertCircle className="w-8 h-8 text-green-600" />
            <p>No duplicates found. Your playlist is clean.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between border-b pb-2 mb-1 flex-wrap gap-2">
              <div className="flex gap-2 flex-wrap">
                <Badge variant="outline">URL: {duplicates?.totalUrlDuplicates ?? 0}</Badge>
                <Badge variant="outline">Title: {duplicates?.totalTitleDuplicates ?? 0}</Badge>
                <Badge variant="outline">
                  Host+File: {duplicates?.totalHostFilenameDuplicates ?? 0}
                </Badge>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={selectAllExceptFirst}
                data-testid="button-select-all-duplicates"
              >
                Select All (Keep First)
              </Button>
            </div>

            <div className="flex items-center gap-2 pb-2">
              <Checkbox
                id="merge-overwrite"
                checked={mergeOverwrite}
                onCheckedChange={(v) => setMergeOverwrite(!!v)}
                data-testid="checkbox-merge-overwrite"
              />
              <Label htmlFor="merge-overwrite" className="text-xs text-muted-foreground cursor-pointer">
                Merge & Keep: overwrite existing fields on keeper (default: fill gaps only)
              </Label>
            </div>

            <ScrollArea className="flex-1 min-h-[200px]">
              <div className="space-y-4 pr-1">
                {urlDups.map((group, i) => (
                  <DuplicateGroup
                    key={`url-${i}`}
                    group={group}
                    label="URL Duplicate Group"
                    colorClass="text-destructive"
                    index={i}
                    episodesMap={episodesMap}
                    selectedDuplicates={selectedDuplicates}
                    onToggle={toggleDuplicate}
                    onAutoSelect={autoSelectForGroup}
                    onMerge={handleMerge}
                  />
                ))}
                {titleDups.map((group, i) => (
                  <DuplicateGroup
                    key={`title-${i}`}
                    group={group}
                    label="Title Duplicate Group"
                    colorClass="text-yellow-600"
                    index={i}
                    episodesMap={episodesMap}
                    selectedDuplicates={selectedDuplicates}
                    onToggle={toggleDuplicate}
                    onAutoSelect={autoSelectForGroup}
                    onMerge={handleMerge}
                  />
                ))}
                {hostFileDups.map((group, i) => (
                  <DuplicateGroup
                    key={`hostfile-${i}`}
                    group={group}
                    label="Host+Filename Duplicate Group"
                    colorClass="text-blue-600"
                    index={i}
                    episodesMap={episodesMap}
                    selectedDuplicates={selectedDuplicates}
                    onToggle={toggleDuplicate}
                    onAutoSelect={autoSelectForGroup}
                    onMerge={handleMerge}
                  />
                ))}
              </div>
            </ScrollArea>
          </>
        )}

        <DialogFooter className="flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-cancel-duplicates"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={selectedDuplicates.length === 0}
            data-testid="button-delete-duplicates"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete Selected ({selectedDuplicates.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
