import React, { useState } from "react";
import { Upload, Download, FileJson, Edit, Trash2, XCircle, Search, Copy, Tag, Loader2, Filter, X, Globe, Sparkles, Tv, Radio, Hash, ImageDown, ArrowLeftRight, Layers3, Eraser, Database } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Badge } from "@/src/components/ui/badge";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/src/components/ui/tabs";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/src/components/ui/popover";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/src/lib/queryClient";
import { useToast } from "@/src/hooks/use-toast";

type ViewTab = "all" | "valid" | "invalid" | "warning" | "long";

interface ActionToolbarProps {
  selectedCount?: number;
  totalCount?: number;
  onImport?: () => void;
  onBrowseArchive?: () => void;
  onSearchArchive?: () => void;
  onStreamFinder?: () => void;
  onTVPlayer?: () => void;
  onLivePlayer2?: () => void;
  onWeeblyPlay2?: () => void;
  onExportJSON?: () => void;
  onGenerateM3U?: () => void;
  onExportWeebly?: () => void;
  onExportM3UWithWeebly?: () => void;
  onRepairMetadata?: () => void;
  onBulkCleanTitles?: () => void;
  onBulkUpdate?: () => void;
  onBulkEditTitles?: () => void;
  onEditSelected?: () => void;
  onDeleteSelected?: () => void;
  onClearAll?: () => void;
  onValidateUrls?: () => void;
  onFindDuplicates?: () => void;
  onBulkAssignGroup?: () => void;
  onRenumber?: () => void;
  onCacheLogos?: () => void;
  uncachedLogoCount?: number;
  isCachingLogos?: boolean;
  isValidating?: boolean;
  activeFilterCount?: number;
  onOpenFilters?: () => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  activeTab?: ViewTab;
  onTabChange?: (tab: ViewTab) => void;
  validCount?: number;
  invalidCount?: number;
  warningCount?: number;
  longCount?: number;
  searchInputRef?: React.RefObject<HTMLInputElement>;
  selectedIds?: string[];
}

export default function ActionToolbar({
  selectedCount = 0,
  totalCount = 0,
  onImport,
  onBrowseArchive,
  onSearchArchive,
  onStreamFinder,
  onTVPlayer,
  onLivePlayer2,
  onWeeblyPlay2,
  onExportJSON,
  onGenerateM3U,
  onExportWeebly,
  onExportM3UWithWeebly,
  onRepairMetadata,
  onBulkCleanTitles,
  onBulkUpdate,
  onBulkEditTitles,
  onEditSelected,
  onDeleteSelected,
  onClearAll,
  onValidateUrls,
  onFindDuplicates,
  onBulkAssignGroup,
  onRenumber,
  onCacheLogos,
  uncachedLogoCount = 0,
  isCachingLogos = false,
  isValidating = false,
  activeFilterCount = 0,
  onOpenFilters,
  searchQuery = "",
  onSearchChange,
  activeTab = "all",
  onTabChange,
  validCount = 0,
  invalidCount = 0,
  warningCount = 0,
  longCount = 0,
  searchInputRef,
  selectedIds = [],
}: ActionToolbarProps) {
  const { toast } = useToast();
  const [swapOpen, setSwapOpen] = useState(false);
  const [findStr, setFindStr] = useState("");
  const [replaceStr, setReplaceStr] = useState("");

  const swapMutation = useMutation({
    mutationFn: (body: { find: string; replace: string; ids?: string[] }) =>
      apiRequest("PATCH", "/api/episodes/swap-url", body),
    onSuccess: async (res: Response) => {
      const data = await res.json();
      toast({ title: `Swapped URLs in ${data.updated} episode(s)` });
      queryClient.invalidateQueries({ queryKey: ["/api/episodes"] });
      setSwapOpen(false);
      setFindStr("");
      setReplaceStr("");
    },
    onError: () => {
      toast({ title: "URL swap failed", variant: "destructive" });
    },
  });

  const handleSwapSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!findStr) return;
    swapMutation.mutate({
      find: findStr,
      replace: replaceStr,
      ids: selectedIds.length > 0 ? selectedIds : undefined,
    });
  };

  return (
    <div className="flex flex-col gap-3 py-3 border-b bg-background sticky top-0 z-10">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="default" size="sm" onClick={onImport} data-testid="button-import">
            <Upload className="w-4 h-4 mr-2" />
            Import M3U
          </Button>
          <Button variant="outline" size="sm" onClick={onBrowseArchive} data-testid="button-browse-archive">
            <Globe className="w-4 h-4 mr-2" />
            Archive.org
          </Button>
          <Button variant="outline" size="sm" onClick={onSearchArchive} data-testid="button-search-archive">
            <Sparkles className="w-4 h-4 mr-2" />
            Search Archive
          </Button>
          <Button variant="outline" size="sm" onClick={onStreamFinder} data-testid="button-stream-finder">
            <Radio className="w-4 h-4 mr-2" />
            Stream Finder
          </Button>
          <Button variant="outline" size="sm" onClick={onTVPlayer} data-testid="button-tv-player">
            <Tv className="w-4 h-4 mr-2" />
            TV Player
          </Button>
          {onLivePlayer2 && (
            <Button variant="outline" size="sm" onClick={onLivePlayer2} data-testid="button-live-player-2" className="text-blue-400 border-blue-400/40 hover:text-blue-300">
              <Tv className="w-4 h-4 mr-2" />
              Live Player 2
            </Button>
          )}
          {onWeeblyPlay2 && (
            <Button variant="outline" size="sm" onClick={onWeeblyPlay2} data-testid="button-weebly-play-2" className="text-amber-400 border-amber-400/40 hover:text-amber-300">
              <Tv className="w-4 h-4 mr-2" />
              Weebly Play 2
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={onExportJSON} data-testid="button-export-json">
            <FileJson className="w-4 h-4 mr-2" />
            Export JSON
          </Button>
          <Button variant="secondary" size="sm" onClick={onGenerateM3U} data-testid="button-generate-m3u">
            <Download className="w-4 h-4 mr-2" />
            Generate M3U
          </Button>
          <Button variant="secondary" size="sm" onClick={onExportM3UWithWeebly} data-testid="button-export-m3u-weebly" title="Export M3U and Weebly player">
            <Layers3 className="w-4 h-4 mr-2" />
            M3U + Weebly
          </Button>
          <Button variant="secondary" size="sm" onClick={onExportWeebly} data-testid="button-export-weebly" title="Export self-contained Weebly HTML player">
            <Globe className="w-4 h-4 mr-2" />
            Weebly Player
          </Button>
          {totalCount > 0 && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={onValidateUrls}
                disabled={isValidating}
                data-testid="button-validate-urls"
              >
                {isValidating ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Search className="w-4 h-4 mr-2" />
                )}
                {isValidating ? "Validating..." : "Validate URLs"}
              </Button>
              <Button variant="outline" size="sm" onClick={onFindDuplicates} data-testid="button-find-duplicates">
                <Copy className="w-4 h-4 mr-2" />
                Find Duplicates
              </Button>
              <Button variant="outline" size="sm" onClick={onRenumber} data-testid="button-renumber">
                <Hash className="w-4 h-4 mr-2" />
                Fix Numbering
              </Button>
              {uncachedLogoCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onCacheLogos}
                  disabled={isCachingLogos}
                  data-testid="button-cache-logos"
                >
                  {isCachingLogos ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <ImageDown className="w-4 h-4 mr-2" />
                  )}
                  {isCachingLogos ? "Caching..." : "Cache Logos"}
                  <Badge variant="secondary" className="ml-1.5 no-default-active-elevate">
                    {uncachedLogoCount}
                  </Badge>
                </Button>
              )}

              <Popover open={swapOpen} onOpenChange={setSwapOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" data-testid="button-swap-urls">
                    <ArrowLeftRight className="w-4 h-4 mr-2" />
                    Swap URLs
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80" align="start">
                  <form onSubmit={handleSwapSubmit} className="space-y-3">
                    <div className="space-y-1">
                      <h4 className="text-sm font-semibold">Batch URL Swap</h4>
                      <p className="text-xs text-muted-foreground">
                        {selectedIds.length > 0
                          ? `Applies to ${selectedIds.length} selected episode(s).`
                          : "Applies to all episodes."}
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="swap-find" className="text-xs">Find</Label>
                      <Input
                        id="swap-find"
                        value={findStr}
                        onChange={(e) => setFindStr(e.target.value)}
                        placeholder="URL fragment to find"
                        className="h-8 text-sm"
                        data-testid="input-swap-find"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="swap-replace" className="text-xs">Replace with</Label>
                      <Input
                        id="swap-replace"
                        value={replaceStr}
                        onChange={(e) => setReplaceStr(e.target.value)}
                        placeholder="Replacement text"
                        className="h-8 text-sm"
                        data-testid="input-swap-replace"
                      />
                    </div>
                    <Button
                      type="submit"
                      size="sm"
                      className="w-full"
                      disabled={!findStr || swapMutation.isPending}
                      data-testid="button-swap-urls-submit"
                    >
                      {swapMutation.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : null}
                      Apply
                    </Button>
                  </form>
                </PopoverContent>
              </Popover>
              <Button variant="destructive" size="sm" onClick={onClearAll} data-testid="button-clear-all">
                <XCircle className="w-4 h-4 mr-2" />
                Clear All
              </Button>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenFilters}
            data-testid="button-open-filters"
          >
            <Filter className="w-4 h-4 mr-2" />
            Filters
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-1.5 no-default-active-elevate">
                {activeFilterCount}
              </Badge>
            )}
          </Button>

          {selectedCount > 0 && (
            <>
              <Badge variant="secondary" data-testid="badge-selected-count">
                {selectedCount} selected
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={onBulkAssignGroup}
                data-testid="button-bulk-assign-group"
              >
                <Tag className="w-4 h-4 mr-2" />
                Set Group
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onBulkCleanTitles}
                data-testid="button-bulk-clean-titles"
              >
                <Eraser className="w-4 h-4 mr-2" />
                Clean Titles
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onBulkEditTitles}
                data-testid="button-bulk-edit-titles"
              >
                <Edit className="w-4 h-4 mr-2" />
                Edit Titles
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onBulkUpdate}
                data-testid="button-bulk-update"
              >
                <Database className="w-4 h-4 mr-2" />
                Bulk Update
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onEditSelected}
                data-testid="button-edit-selected"
              >
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={onDeleteSelected}
                data-testid="button-delete-selected"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            </>
          )}
        </div>
      </div>

      {totalCount > 0 && (
        <div className="flex items-center justify-between flex-wrap gap-3">
          <Tabs value={activeTab} onValueChange={(v) => onTabChange?.(v as ViewTab)} className="w-auto">
            <TabsList className="h-8" data-testid="tabs-view">
              <TabsTrigger value="all" className="text-xs px-3" data-testid="tab-all">
                All ({totalCount})
              </TabsTrigger>
              <TabsTrigger value="valid" className="text-xs px-3" data-testid="tab-valid">
                Valid ({validCount})
              </TabsTrigger>
              <TabsTrigger value="warning" className="text-xs px-3" data-testid="tab-warning">
                Warning ({warningCount})
              </TabsTrigger>
              <TabsTrigger value="invalid" className="text-xs px-3" data-testid="tab-invalid">
                Invalid ({invalidCount})
              </TabsTrigger>
              <TabsTrigger value="long" className="text-xs px-3" data-testid="tab-long">
                Long ({longCount})
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              type="text"
              placeholder="Search episodes... (Ctrl+F)"
              value={searchQuery}
              onChange={(e) => onSearchChange?.(e.target.value)}
              className="pl-9 pr-9 h-8"
              data-testid="input-search"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6"
                onClick={() => onSearchChange?.("")}
                data-testid="button-clear-search"
              >
                <X className="w-3 h-3" />
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
