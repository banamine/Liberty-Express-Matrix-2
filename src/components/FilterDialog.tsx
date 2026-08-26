import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import { Button } from "@/src/components/ui/button";
import { Badge } from "@/src/components/ui/badge";
import { Checkbox } from "@/src/components/ui/checkbox";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { AlertCircle, Search, X } from "lucide-react";

interface FacetItem {
  value: string;   // "" = null (no group/host)
  count: number;
}

interface Facets {
  groups: FacetItem[];
  hosts:  FacetItem[];
}

interface FilterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeGroups: string[];
  activeHosts:  string[];
  onApply: (groups: string[], hosts: string[]) => void;
}

function FacetList({
  items,
  selected,
  onToggle,
  nullLabel,
  searchPlaceholder,
}: {
  items: FacetItem[];
  selected: string[];
  onToggle: (value: string) => void;
  nullLabel: string;
  searchPlaceholder: string;
}) {
  const [query, setQuery] = useState("");

  const visible = query.trim()
    ? items.filter(item => {
        const label = item.value === "" ? nullLabel : item.value;
        return label.toLowerCase().includes(query.trim().toLowerCase());
      })
    : items;

  if (items.length === 0) {
    return (
      <p className="text-xs text-muted-foreground py-2 text-center">No items found.</p>
    );
  }

  return (
    <div className="space-y-1.5">
      {items.length > 8 && (
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-7 pl-7 pr-7 text-xs"
            data-testid={`input-facet-search-${searchPlaceholder.toLowerCase().replace(/\s+/g, "-")}`}
          />
          {query && (
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setQuery("")}
              aria-label="Clear search"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      )}

      <div>
        {visible.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2 text-center">No matches for "{query}".</p>
        ) : (
          <div className="space-y-0.5">
            {visible.map((item) => {
              const id = `facet-${nullLabel}-${item.value || "__null__"}`;
              const label = item.value === "" ? nullLabel : item.value;
              const isNullItem = item.value === "";
              return (
                <div
                  key={id}
                  className="flex items-start gap-2.5 px-1 py-1 rounded cursor-pointer hover-elevate"
                  onClick={() => onToggle(item.value)}
                >
                  <Checkbox
                    id={id}
                    checked={selected.includes(item.value)}
                    onCheckedChange={() => onToggle(item.value)}
                    data-testid={`checkbox-facet-${item.value || "null"}`}
                    className="mt-0.5"
                  />
                  <label
                    htmlFor={id}
                    className={`flex-1 text-sm cursor-pointer break-words min-w-0 ${isNullItem ? "italic text-muted-foreground" : ""}`}
                  >
                    {label}
                  </label>
                  <Badge variant="secondary" className="text-xs shrink-0 no-default-active-elevate">
                    {item.count}
                  </Badge>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function FilterDialog({
  open,
  onOpenChange,
  activeGroups,
  activeHosts,
  onApply,
}: FilterDialogProps) {
  const [draftGroups, setDraftGroups] = useState<string[]>(activeGroups);
  const [draftHosts,  setDraftHosts]  = useState<string[]>(activeHosts);
  const [facetSort, setFacetSort] = useState<"count-desc" | "value-asc">("count-desc");

  useEffect(() => {
    if (open) {
      setDraftGroups(activeGroups.map((g) => g.trim()).filter(Boolean));
      setDraftHosts(activeHosts.map((h) => h.trim()).filter(Boolean));
    }
  }, [open]);

  const { data: facets, isError } = useQuery<Facets>({
    queryKey: ["/api/episodes/facets", facetSort],
    retry: 1,
    queryFn: async () => {
      const res = await fetch(`/api/episodes/facets?sort=${facetSort}`);
      if (!res.ok) throw new Error("Failed to load facets");
      return res.json();
    },
    staleTime: 60_000,
    enabled: open,
  });

  const toggleGroup = (value: string) =>
    setDraftGroups(prev => {
      const next = value.trim();
      return prev.includes(next) ? prev.filter(x => x !== next) : [...prev, next];
    });

  const toggleHost = (value: string) =>
    setDraftHosts(prev => {
      const next = value.trim();
      return prev.includes(next) ? prev.filter(x => x !== next) : [...prev, next];
    });

  const handleClearAll = () => {
    setDraftGroups([]);
    setDraftHosts([]);
  };

  const handleApply = () => {
    onApply(draftGroups.map((g) => g.trim()).filter(Boolean), draftHosts.map((h) => h.trim()).filter(Boolean));
  };

  const totalDraft = draftGroups.length + draftHosts.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] flex flex-col overflow-hidden" data-testid="dialog-filters">
        <DialogHeader>
          <DialogTitle>Filters</DialogTitle>
          <DialogDescription>
            Select groups and/or hosts to narrow results. OR within each dimension, AND across dimensions.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 pb-1">
          <span className="text-xs text-muted-foreground">Sort by:</span>
          <Button
            size="sm"
            variant={facetSort === "count-desc" ? "default" : "outline"}
            onClick={() => setFacetSort("count-desc")}
            data-testid="button-sort-facet-count"
          >
            Count
          </Button>
          <Button
            size="sm"
            variant={facetSort === "value-asc" ? "default" : "outline"}
            onClick={() => setFacetSort("value-asc")}
            data-testid="button-sort-facet-name"
          >
            Name
          </Button>
        </div>

        {isError ? (
          <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            Could not load filter options.
          </div>
        ) : (
          <div className="space-y-4 flex-1 min-h-0 overflow-y-auto pr-2">
            <div className="space-y-2">
              <div className="sticky top-0 bg-background z-10 pb-1">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Group
                  {draftGroups.length > 0 && (
                    <Badge variant="secondary" className="ml-2 no-default-active-elevate">
                      {draftGroups.length}
                    </Badge>
                  )}
                </Label>
              </div>
              <FacetList
                items={facets?.groups ?? []}
                selected={draftGroups}
                onToggle={toggleGroup}
                nullLabel="(No Group)"
                searchPlaceholder="Search groups…"
              />
            </div>

            <div className="space-y-2">
              <div className="sticky top-0 bg-background z-10 pb-1">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Source Host
                  {draftHosts.length > 0 && (
                    <Badge variant="secondary" className="ml-2 no-default-active-elevate">
                      {draftHosts.length}
                    </Badge>
                  )}
                </Label>
              </div>
              <FacetList
                items={facets?.hosts ?? []}
                selected={draftHosts}
                onToggle={toggleHost}
                nullLabel="(No Host)"
                searchPlaceholder="Search hosts…"
              />
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button
            variant="ghost"
            onClick={handleClearAll}
            disabled={totalDraft === 0}
            data-testid="button-filter-clear"
          >
            Clear All
          </Button>
          <Button
            onClick={handleApply}
            data-testid="button-filter-apply"
          >
            Apply{totalDraft > 0 ? ` (${totalDraft})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
