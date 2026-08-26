import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/src/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/src/components/ui/tabs";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Checkbox } from "@/src/components/ui/checkbox";
import { Badge } from "@/src/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";
import { useToast } from "@/src/hooks/use-toast";
import { toast as sonnerToast } from "sonner";
import { Archive, Loader2, ExternalLink, Film, Library, Tv, AlertTriangle } from "lucide-react";
import { RelativeTime, ThumbnailCell } from "./archive-shared";
import { ScrollArea } from "@/src/components/ui/scroll-area";
import TVNewsResultsSheet from "./TVNewsResultsSheet";
import { Skeleton } from "@/src/components/ui/skeleton";
import { Switch } from "@/src/components/ui/switch";

interface ArchiveImportDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

interface ArchiveItem {
  identifier: string;
  filename: string;
  title: string;
  url: string;
  thumbnailUrl: string | null;
  duration: number;
  format: string;
  size: number;
  suspect?: boolean;
}

interface ArchiveMetadata {
  identifier: string;
  title?: string;
  description?: string;
  creator?: string;
  date?: string;
}

interface FetchResponse {
  items: ArchiveItem[];
  metadata: ArchiveMetadata;
  errors: string[];
  count: number;
}

interface CollectionItem {
  identifier: string;
  title: string;
  thumbnailUrl: string;
  mediatype: string;
  creator: string;
  downloads: number;
}

interface RssItem {
  identifier: string;
  title: string;
  thumbnailUrl: string;
  mediatype: string;
  isTvNews: boolean;
}

interface CollectionResponse {
  items: CollectionItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  collection: string;
  cappedAt10k: boolean;
}

interface TVNewsItem {
  identifier: string;
  title: string;
  network: string;
  program: string;
  date: string;
  time: string;
  durationMins: number;
  thumbnailUrl: string;
  publicdate: string;
  airDateSource: 'identifier' | 'publicdate';
}

const TV_NETWORKS = [
  { label: "Fox News",          value: "TV-FOXNEWSW"          },
  { label: "MSNBC",             value: "TV-MSNBCW"            },
  { label: "CNN",               value: "TV-CNNW"              },
  { label: "CNBC",              value: "TV-CNBCW"             },
  { label: "NBC News",          value: "TV-NBCNEWS"           },
  { label: "ABC News",          value: "TV-ABCNEWS"           },
  { label: "CBS News",          value: "TV-CBSNEWS"           },
  { label: "OAN",               value: "TV-OANN"              },
  { label: "Newsmax",           value: "TV-NEWSMAX"           },
  { label: "Bloomberg TV",      value: "TV-BLOOMBERG"         },
  { label: "NTD News",          value: "TV-NTDTV"             },
  { label: "WION",              value: "TV-WION"              },
  { label: "Al Jazeera English",value: "TV-ALJAZEERA"         },
  { label: "France 24",         value: "TV-FRANCE24"          },
  { label: "DW News",           value: "TV-DW"                },
  { label: "RT News",           value: "TV-RT"                },
  { label: "BBC News",          value: "TV-BBCNEWS"           },
  { label: "KPIX (CBS SF)",     value: "TV-KPIX"              },
  { label: "Infowars",          value: "__custom__infowars"   },
  { label: "Rebel News",        value: "__custom__rebelnews"  },
  { label: "Real America Voice",value: "__custom__rav"        },
  { label: "TCN",               value: "__custom__tcn"        },
  { label: "The Standard",      value: "__custom__standard"   },
  { label: "Other…",            value: "__custom__"           },
];

const TV_SEGMENT_WARN_THRESHOLD = 500;

function formatDuration(seconds: number): string {
  if (seconds === 0) return "--:--";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

function formatSize(bytes: number): string {
  if (bytes === 0) return "--";
  const units = ["B", "KB", "MB", "GB"];
  let unitIndex = 0;
  let size = bytes;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

const SORT_OPTIONS = [
  { label: "Popular (downloads ↓)", value: "downloads+desc" },
  { label: "Newest first",          value: "addeddate+desc" },
  { label: "Oldest first",          value: "addeddate+asc" },
  { label: "Title A–Z",             value: "title+asc" },
];

const ROWS_OPTIONS = [50, 100, 200, 500];

export default function ArchiveImportDialog({ open = false, onOpenChange }: ArchiveImportDialogProps) {
  const [activeTab, setActiveTab] = useState<"direct" | "collection" | "tvnews" | "list">("direct");

  const [archiveUrl, setArchiveUrl] = useState("");
  const [groupTitle, setGroupTitle] = useState("");
  const [previewData, setPreviewData] = useState<FetchResponse | null>(null);
  const [rssItems, setRssItems] = useState<RssItem[]>([]);
  const [rssSelectedIds, setRssSelectedIds] = useState<Set<string>>(new Set());
  const [rssMode, setRssMode] = useState(false);

  const [collectionInput, setCollectionInput] = useState("");
  const [collectionItems, setCollectionItems] = useState<CollectionItem[]>([]);
  const [collectionTotal, setCollectionTotal] = useState(0);
  const [collectionPage, setCollectionPage] = useState(1);
  const [collectionCappedAt10k, setCollectionCappedAt10k] = useState(false);
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<Set<string>>(new Set());
  const [collectionGroupTitle, setCollectionGroupTitle] = useState("");
  const [collectionSort, setCollectionSort] = useState("downloads+desc");
  const [collectionRows, setCollectionRows] = useState(100);

  // TV News tab state
  const [tvNetwork, setTvNetwork] = useState(TV_NETWORKS[0].value);
  const [tvCustomNetwork, setTvCustomNetwork] = useState("");
  const [tvQuery, setTvQuery] = useState("");
  const [tvStartDate, setTvStartDate] = useState("");
  const [tvEndDate, setTvEndDate] = useState("");
  const [tvOffset, setTvOffset] = useState(0);
  const [tvItems, setTvItems] = useState<TVNewsItem[]>([]);
  const [tvTotal, setTvTotal] = useState(0);
  const [tvHasSearched, setTvHasSearched] = useState(false);
  const [tvLastChecked, setTvLastChecked] = useState<Date | null>(null);
  const [tvSelectedIds, setTvSelectedIds] = useState<Set<string>>(new Set());
  const [tvExpandSegments, setTvExpandSegments] = useState(false);
  const [tvSegmentSecs, setTvSegmentSecs] = useState(60);
  const [tvGroupTitle, setTvGroupTitle] = useState("");
  const [tvSheetOpen, setTvSheetOpen] = useState(false);

  const tvAllSelected = tvItems.length > 0 && tvSelectedIds.size === tvItems.length;
  const tvSomeSelected = tvSelectedIds.size > 0 && tvSelectedIds.size < tvItems.length;
  const canTvLoadMore = tvItems.length < tvTotal && tvItems.length > 0;
  const tvProjectedEpisodes = tvExpandSegments
    ? tvSelectedIds.size * Math.ceil(3600 / tvSegmentSecs)
    : tvSelectedIds.size;
  const tvWarnLargeImport = tvProjectedEpisodes > TV_SEGMENT_WARN_THRESHOLD;

  const toggleTvItem = (id: string) => {
    setTvSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleAllTv = () => {
    if (tvAllSelected) setTvSelectedIds(new Set());
    else setTvSelectedIds(new Set(tvItems.map((i) => i.identifier)));
  };

  // Auto-refresh TV news results when tab regains focus after >30 min
  useEffect(() => {
    const STALE_MS = 30 * 60 * 1000;
    const handler = () => {
      if (
        document.visibilityState === "visible" &&
        tvHasSearched &&
        tvLastChecked !== null &&
        Date.now() - tvLastChecked.getTime() > STALE_MS &&
        !tvSearchMutation.isPending
      ) {
        tvSearchMutation.mutate(false);
      }
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [tvHasSearched, tvLastChecked]);

  const { toast } = useToast();

  const isRssUrl = (url: string) => /archive\.org\/services\/collection-rss\.php\?.*\bcollection=/i.test(url.trim());

  const rssScanMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/archive/expand-rss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rssUrl: archiveUrl.trim() }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "RSS scan failed");
      }
      return response.json() as Promise<{ items: RssItem[]; total: number }>;
    },
    onSuccess: (data) => {
      setRssMode(true);
      setRssItems(data.items);
      setRssSelectedIds(new Set(data.items.map((i) => i.identifier)));
    },
    onError: (error: Error) =>
      toast({ title: "Failed to scan RSS feed", description: error.message, variant: "destructive" }),
  });

  const rssImportMutation = useMutation({
    mutationFn: async () => {
      const selected = rssItems.filter((i) => rssSelectedIds.has(i.identifier));
      if (selected.length === 0) throw new Error("No items selected");
      const response = await fetch("/api/archive/import-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: selected.map((i) => ({
            identifier: i.identifier,
            title: i.title,
            mediatype: i.mediatype,
          })),
          groupTitle: groupTitle || undefined,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Import failed");
      }
      return response.json() as Promise<{ message: string; imported: number }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/episodes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/episodes/groups"] });
      toast({
        title: "RSS import complete",
        description: data.message || `${data.imported} items imported`,
      });
      handleClose();
    },
    onError: (error: Error) =>
      toast({ title: "RSS import failed", description: error.message, variant: "destructive" }),
  });

  const fetchMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/archive/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: archiveUrl }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Fetch failed");
      }
      return response.json() as Promise<FetchResponse>;
    },
    onSuccess: (data) => {
      setPreviewData(data);
      if (data.metadata.title) setGroupTitle(data.metadata.title);
    },
    onError: (error: Error) =>
      sonnerToast.error(error.message || "Failed to fetch from Archive.org"),
  });

  const listImportMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/archive/import-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: archiveUrl, groupTitle: groupTitle || undefined }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "List import failed");
      }
      return response.json();
    },
    onSuccess: (data) => {
      sonnerToast.success(data.message || "List items imported successfully");
      queryClient.invalidateQueries({ queryKey: ["/api/episodes"] });
      onOpenChange?.(false);
    },
    onError: (error: Error) => {
      sonnerToast.error(`Failed to import list: ${error.message}`);
    }
  });

  const importMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/archive/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: archiveUrl, groupTitle: groupTitle || undefined }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Import failed");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/episodes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/episodes/groups"] });
      toast({ title: "Successfully imported from Archive.org", description: data.message });
      handleClose();
    },
    onError: (error: Error) =>
      toast({ title: "Import failed", description: error.message, variant: "destructive" }),
  });

  const collectionFetchMutation = useMutation({
    mutationFn: async (pageNum: number) => {
      const response = await fetch("/api/archive/collection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          collection: collectionInput.trim(),
          page: pageNum,
          rows: collectionRows,
          sort: collectionSort,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Fetch failed");
      }
      return response.json() as Promise<CollectionResponse>;
    },
    onSuccess: (data, pageNum) => {
      if (pageNum === 1) {
        setCollectionItems(data.items);
        setCollectionTotal(data.total);
        setCollectionPage(1);
        setCollectionCappedAt10k(data.cappedAt10k);
        setSelectedCollectionIds(new Set(data.items.map((i) => i.identifier)));
      } else {
        setCollectionItems((prev) => [...prev, ...data.items]);
        setCollectionPage(pageNum);
      }
    },
    onError: (error: Error) =>
      toast({ title: "Collection fetch failed", description: error.message, variant: "destructive" }),
  });

  const collectionImportMutation = useMutation({
    mutationFn: async () => {
      const items = Array.from(selectedCollectionIds).map((id) => ({
        identifier: id,
        title: collectionItems.find((i) => i.identifier === id)?.title ?? id,
      }));
      const response = await fetch("/api/archive/import-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, groupTitle: collectionGroupTitle || undefined }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Import failed");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/episodes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/episodes/groups"] });
      const imported = data.imported ?? data.results?.filter((r: any) => r.files > 0).length ?? 0;
      toast({
        title: "Import complete",
        description: `${imported} item${imported !== 1 ? "s" : ""} imported. Open the Episodes tab to review.`,
      });
      handleClose();
    },
    onError: (error: Error) =>
      toast({ title: "Collection import failed", description: error.message, variant: "destructive" }),
  });

  const tvSearchMutation = useMutation<{ items: TVNewsItem[]; total: number }, Error, boolean>({
    mutationFn: async (isLoadMore: boolean) => {
      const effectiveNetwork = tvNetwork.startsWith("__custom__") ? tvCustomNetwork.trim() : tvNetwork;
      const response = await fetch("/api/archive/tvnews/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          network: effectiveNetwork,
          query: tvQuery || undefined,
          startDate: tvStartDate || undefined,
          endDate: tvEndDate || undefined,
          rows: 50,
          start: isLoadMore ? tvOffset : 0,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Search failed");
      }
      return response.json();
    },
    onSuccess: (data, isLoadMore) => {
      setTvHasSearched(true);
      setTvLastChecked(new Date());
      if (isLoadMore) {
        setTvItems((prev) => [...prev, ...data.items]);
      } else {
        setTvItems(data.items);
        setTvSelectedIds(new Set());
        setTvOffset(0);
      }
      setTvTotal(data.total);
      setTvOffset((prev) => (isLoadMore ? prev : 0) + data.items.length);
    },
    onError: (error: Error) =>
      toast({ title: "TV News search failed", description: error.message, variant: "destructive" }),
  });

  const tvImportMutation = useMutation({
    mutationFn: async () => {
      const selected = tvItems.filter((i) => tvSelectedIds.has(i.identifier));
      const response = await fetch("/api/archive/tvnews/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: selected,
          groupTitle: tvGroupTitle || undefined,
          expandSegments: tvExpandSegments,
          segmentSecs: tvSegmentSecs,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Import failed");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/episodes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/episodes/stats"] });
      toast({
        title: "TV News import complete",
        description: `${data.created} added, ${data.updated} updated${tvExpandSegments ? " (segments)" : ""}`,
      });
      setTvSelectedIds(new Set());
    },
    onError: (error: Error) =>
      toast({ title: "TV News import failed", description: error.message, variant: "destructive" }),
  });

  const handleClose = () => {
    setArchiveUrl("");
    setGroupTitle("");
    setPreviewData(null);
    setRssItems([]);
    setRssSelectedIds(new Set());
    setRssMode(false);
    setCollectionInput("");
    setCollectionItems([]);
    setCollectionTotal(0);
    setCollectionPage(1);
    setCollectionCappedAt10k(false);
    setSelectedCollectionIds(new Set());
    setCollectionGroupTitle("");
    setTvItems([]);
    setTvTotal(0);
    setTvHasSearched(false);
    setTvSelectedIds(new Set());
    setTvOffset(0);
    onOpenChange?.(false);
  };

  const toggleCollectionItem = (id: string) => {
    setSelectedCollectionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllCollection = () => {
    if (selectedCollectionIds.size === collectionItems.length) {
      setSelectedCollectionIds(new Set());
    } else {
      setSelectedCollectionIds(new Set(collectionItems.map((i) => i.identifier)));
    }
  };

  const isCollectionFetchPending = collectionFetchMutation.isPending;
  const canLoadMore =
    !isCollectionFetchPending &&
    collectionItems.length > 0 &&
    collectionItems.length < Math.min(collectionTotal, 10000);

  const totalDisplay =
    collectionTotal > 10000
      ? `~${collectionTotal.toLocaleString()}`
      : collectionTotal.toLocaleString();

  return (
    <>
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col" data-testid="dialog-archive-import">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Archive className="w-5 h-5" />
            Import from Archive.org
          </DialogTitle>
          <DialogDescription>
            Import by direct URL/identifier, or browse and import items from an Archive.org collection.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "direct" | "collection" | "tvnews" | "list")} className="flex flex-col flex-1 overflow-hidden">
          <TabsList className="w-full justify-start flex-shrink-0">
            <TabsTrigger value="direct" data-testid="tab-direct-import">Direct Import</TabsTrigger>
            <TabsTrigger value="collection" data-testid="tab-collection-import">
              <Library className="w-3.5 h-3.5 mr-1.5" />
              Collection
            </TabsTrigger>
            <TabsTrigger value="tvnews" data-testid="tab-tvnews-import">
              <Tv className="w-3.5 h-3.5 mr-1.5" />
              TV News
            </TabsTrigger>
            <TabsTrigger value="list" data-testid="tab-list-import">
              <Library className="w-3.5 h-3.5 mr-1.5" />
              Lists
            </TabsTrigger>
          </TabsList>


          <TabsContent value="list" className="flex-1 overflow-hidden flex flex-col space-y-4 mt-4">
            <div className="space-y-4">
              <div className="p-4 border rounded-md bg-muted/20">
                <h3 className="font-medium mb-2">Preset Archive Lists (Entertainment Channels)</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Quickly import from curated lists. Note: "Classic News" is intentionally excluded from entertainment playlists per security rules.
                </p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { title: "Documentary", url: "https://archive.org/details/@infobattalion/lists/1/documentary" },
                    { title: "Cartoons", url: "https://archive.org/details/@infobattalion/lists/2/cartoons" },
                    { title: "Tv Classics", url: "https://archive.org/details/@infobattalion/lists/3/tv_classics" },
                    { title: "Movies Classics", url: "https://archive.org/details/@infobattalion/lists/4/movies_classics" },
                    { title: "New World Tyranny", url: "https://archive.org/details/@infobattalion/lists/5/new_world_tyranny" },
                    { title: "Science", url: "https://archive.org/details/@infobattalion/lists/6/science" }
                  ].map(preset => (
                    <Button 
                      key={preset.title}
                      variant="secondary" 
                      size="sm"
                      onClick={() => {
                        setArchiveUrl(preset.url);
                        setGroupTitle(preset.title);
                      }}
                    >
                      {preset.title}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="list-url">Archive.org List URL</Label>
              <Input
                id="list-url"
                value={archiveUrl}
                onChange={(e) => setArchiveUrl(e.target.value)}
                placeholder="e.g. https://archive.org/details/@infobattalion/lists/1/documentary"
                onKeyDown={(e) => { if (e.key === 'Enter') listImportMutation.mutate(); }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="list-group-title">Channel Name (Optional)</Label>
              <Input
                id="list-group-title"
                value={groupTitle}
                onChange={(e) => setGroupTitle(e.target.value)}
                placeholder="e.g. Channel: Documentaries - Infobattalion"
              />
            </div>
            <div className="flex-1" />
            <DialogFooter className="mt-4 flex justify-end">
              <Button onClick={() => listImportMutation.mutate()} disabled={listImportMutation.isPending || !archiveUrl}>
                {listImportMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Archive className="w-4 h-4 mr-2" />}
                Import List
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="direct" className="flex-1 overflow-hidden flex flex-col space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="archive-url">Archive.org URL, Identifier, or RSS Feed</Label>
              <div className="flex gap-2">
                <Input
                  id="archive-url"
                  value={archiveUrl}
                  onChange={(e) => {
                    setArchiveUrl(e.target.value);
                    if (rssMode) { setRssMode(false); setRssItems([]); setRssSelectedIds(new Set()); }
                    if (previewData) setPreviewData(null);
                  }}
                  placeholder="https://archive.org/details/example, identifier, or RSS feed URL"
                  className="flex-1"
                  data-testid="input-archive-url"
                />
                <Button
                  onClick={async () => {
                    if (!archiveUrl.trim()) return;
                    if (isRssUrl(archiveUrl)) {
                      rssScanMutation.mutate();
                    } else {
                      try {
                        await fetchMutation.mutateAsync();
                      } catch (err: any) {
                        sonnerToast.error(err.message || "Failed to fetch from Archive.org");
                      }
                    }
                  }}
                  disabled={!archiveUrl.trim() || fetchMutation.isPending || rssScanMutation.isPending}
                  data-testid="button-preview"
                >
                  {(fetchMutation.isPending || rssScanMutation.isPending) ? <Loader2 className="w-4 h-4 animate-spin" /> : "Preview"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Examples: https://archive.org/details/classic-cartoons, or collection RSS feed URL
              </p>
            </div>

            {rssScanMutation.isPending && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-muted/50 text-sm text-muted-foreground" data-testid="text-rss-scanning">
                <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                Scanning Collection RSS for Playable Clips…
              </div>
            )}

            {rssMode && rssItems.length > 0 && (
              <>
                <div className="p-3 rounded-md bg-muted/50 space-y-1 flex-shrink-0">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <h4 className="font-medium">RSS Collection</h4>
                    <Badge variant="secondary">{rssItems.length} items found</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{rssSelectedIds.size} of {rssItems.length} selected</p>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <Checkbox
                    checked={rssSelectedIds.size === rssItems.length}
                    onCheckedChange={(checked) => {
                      if (checked) setRssSelectedIds(new Set(rssItems.map((i) => i.identifier)));
                      else setRssSelectedIds(new Set());
                    }}
                    data-testid="checkbox-rss-select-all"
                  />
                  <Label className="text-sm cursor-pointer">Select All</Label>
                </div>

                <ScrollArea className="flex-1 min-h-0 border rounded-md">
                  <div className="p-2 space-y-1">
                    {rssItems.map((item, index) => (
                      <div
                        key={`${item.identifier}-${index}`}
                        className="flex items-center gap-3 p-2 rounded hover-elevate cursor-pointer"
                        onClick={() => {
                          setRssSelectedIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(item.identifier)) next.delete(item.identifier);
                            else next.add(item.identifier);
                            return next;
                          });
                        }}
                        data-testid={`rss-item-${item.identifier}`}
                      >
                        <Checkbox
                          checked={rssSelectedIds.has(item.identifier)}
                          onCheckedChange={() => {
                            setRssSelectedIds((prev) => {
                              const next = new Set(prev);
                              if (next.has(item.identifier)) next.delete(item.identifier);
                              else next.add(item.identifier);
                              return next;
                            });
                          }}
                        />
                        <img
                          src={item.thumbnailUrl}
                          alt=""
                          className="w-16 h-10 object-cover rounded bg-muted"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.title}</p>
                          <p className="text-xs text-muted-foreground font-mono">{item.identifier}</p>
                        </div>
                        {item.isTvNews && (
                          <Badge variant="outline" className="shrink-0 text-xs">
                            <Tv className="w-3 h-3 mr-1" />TV News
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>

                <div className="space-y-3 pt-2 border-t flex-shrink-0">
                  <div className="space-y-2">
                    <Label htmlFor="rss-group-title">Group Title (optional)</Label>
                    <Input id="rss-group-title" value={groupTitle} onChange={(e) => setGroupTitle(e.target.value)} placeholder="Leave blank to use item titles" data-testid="input-rss-group-title" />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Label htmlFor="rss-replace" className="text-sm cursor-pointer">
                      Replace existing episodes (clear workbench before import)
                    </Label>
                  </div>
                </div>
              </>
            )}

            {!rssMode && previewData && (
              <>
                <div className="p-3 rounded-md bg-muted/50 space-y-1 flex-shrink-0">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <h4 className="font-medium">{previewData.metadata.title || previewData.metadata.identifier}</h4>
                    <a
                      href={`https://archive.org/details/${previewData.metadata.identifier}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
                    >
                      View on Archive.org <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  {previewData.metadata.creator && (
                    <p className="text-sm text-muted-foreground">By: {previewData.metadata.creator}</p>
                  )}
                  <p className="text-sm font-medium text-primary">{previewData.count} video files found</p>
                </div>

                <ScrollArea className="flex-1 min-h-0 border rounded-md">
                  <div className="p-2 space-y-1">
                    {previewData.items.map((item, index) => (
                      <div key={index} className="flex items-center gap-3 p-2 rounded hover-elevate" data-testid={`preview-item-${index}`}>
                        {item.thumbnailUrl ? (
                          <img src={item.thumbnailUrl} alt="" className="w-16 h-10 object-cover rounded bg-muted" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        ) : (
                          <div className="w-16 h-10 bg-muted rounded flex items-center justify-center">
                            <Film className="w-4 h-4 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="text-sm font-medium truncate">{item.title}</p>
                            {item.suspect && (
                              <Badge variant="outline" className="shrink-0 text-xs border-yellow-500/50 text-yellow-600 dark:text-yellow-400 gap-1" data-testid={`badge-suspect-${index}`}>
                                <AlertTriangle className="w-3 h-3" />
                                short clip
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {item.format} • {formatDuration(item.duration)} • {formatSize(item.size)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>

                <div className="space-y-3 pt-2 border-t flex-shrink-0">
                  <div className="space-y-2">
                    <Label htmlFor="group-title">Group Title (optional)</Label>
                    <Input id="group-title" value={groupTitle} onChange={(e) => setGroupTitle(e.target.value)} placeholder="Leave blank to use collection title" data-testid="input-group-title" />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Label htmlFor="replace-existing" className="text-sm cursor-pointer">
                      Replace existing episodes (clear workbench before import)
                    </Label>
                  </div>
                </div>
              </>
            )}

            {previewData?.errors && previewData.errors.length > 0 && (
              <div className="text-sm text-yellow-500 bg-yellow-500/10 p-2 rounded flex-shrink-0">
                {previewData.errors.map((err, i) => <p key={i}>{err}</p>)}
              </div>
            )}
          </TabsContent>

          <TabsContent value="collection" className="flex-1 overflow-hidden flex flex-col space-y-3 mt-4">
            <div className="space-y-2">
              <Label htmlFor="collection-input">Collection slug or URL</Label>
              <div className="flex gap-2 flex-wrap">
                <Input
                  id="collection-input"
                  value={collectionInput}
                  onChange={(e) => {
                    setCollectionInput(e.target.value);
                    if (collectionItems.length > 0) setCollectionItems([]);
                  }}
                  placeholder="e.g., film_scifi  or  https://archive.org/details/film_scifi"
                  className="flex-1 min-w-40"
                  data-testid="input-collection"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && collectionInput.trim() && !isCollectionFetchPending)
                      collectionFetchMutation.mutate(1);
                  }}
                />
                <Select
                  value={collectionSort}
                  onValueChange={(v) => {
                    setCollectionSort(v);
                    if (collectionItems.length > 0) setCollectionItems([]);
                  }}
                >
                  <SelectTrigger className="w-36" data-testid="select-collection-sort">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SORT_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={String(collectionRows)}
                  onValueChange={(v) => {
                    setCollectionRows(Number(v));
                    if (collectionItems.length > 0) setCollectionItems([]);
                  }}
                >
                  <SelectTrigger className="w-24" data-testid="select-collection-rows">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROWS_OPTIONS.map((r) => (
                      <SelectItem key={r} value={String(r)}>{r} rows</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={() => collectionInput.trim() && collectionFetchMutation.mutate(1)}
                  disabled={!collectionInput.trim() || isCollectionFetchPending}
                  data-testid="button-fetch-collection"
                >
                  {isCollectionFetchPending && collectionPage === 1 ? <Loader2 className="w-4 h-4 animate-spin" /> : "Fetch"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Sort affects order — change then Fetch to update. Larger rows = more items per load but slower.
              </p>
            </div>

            {isCollectionFetchPending && collectionPage === 1 && (
              <div className="border rounded-md p-2 space-y-1 flex-shrink-0" data-testid="skeleton-collection-list">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 p-2">
                    <Skeleton className="w-5 h-5 rounded" />
                    <Skeleton className="w-14 h-9 rounded flex-shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-3/4" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                    <Skeleton className="w-14 h-5 rounded-full" />
                  </div>
                ))}
              </div>
            )}

            {!isCollectionFetchPending && collectionItems.length === 0 && collectionTotal === 0 && collectionFetchMutation.isSuccess && (
              <p className="text-sm text-muted-foreground py-4 text-center" data-testid="text-collection-empty">
                No items found in this collection.
              </p>
            )}

            {collectionItems.length > 0 && (
              <>
                <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                  <Badge variant="outline" data-testid="badge-collection-count">
                    {totalDisplay} total
                  </Badge>
                  <Badge variant="secondary">{collectionItems.length} loaded</Badge>
                  <Button variant="outline" size="sm" onClick={toggleAllCollection} data-testid="button-collection-toggle-all">
                    {selectedCollectionIds.size === collectionItems.length
                      ? "Deselect All"
                      : `Select All (${collectionItems.length} loaded)`}
                  </Button>
                  <Badge variant="secondary">{selectedCollectionIds.size} selected</Badge>
                </div>

                {collectionCappedAt10k && (
                  <div className="text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2 flex-shrink-0" data-testid="banner-collection-cap">
                    Archive.org returns at most 10,000 sorted results — narrow by mediatype or date if needed.
                  </div>
                )}

                {collectionTotal > 5000 && !collectionCappedAt10k && (
                  <p className="text-xs text-muted-foreground flex-shrink-0" data-testid="note-large-collection">
                    Large collection — loading additional pages may be slow.
                  </p>
                )}

                <ScrollArea className="flex-1 min-h-0 border rounded-md">
                  <div className="p-2 space-y-1">
                    {collectionItems.map((item, index) => (
                      <div
                        key={`${item.identifier}-${index}`}
                        className={`flex items-center gap-3 p-2 rounded cursor-pointer hover-elevate ${selectedCollectionIds.has(item.identifier) ? "bg-primary/5" : ""}`}
                        onClick={() => toggleCollectionItem(item.identifier)}
                        data-testid={`collection-item-${index}`}
                      >
                        <Checkbox
                          checked={selectedCollectionIds.has(item.identifier)}
                          onCheckedChange={() => toggleCollectionItem(item.identifier)}
                          data-testid={`checkbox-collection-${item.identifier}`}
                        />
                        <ThumbnailCell url={item.thumbnailUrl} alt={item.title} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.title}</p>
                          <a
                            href={`https://archive.org/details/${item.identifier}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-muted-foreground hover:text-foreground font-mono"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {item.identifier}
                          </a>
                        </div>
                        <Badge variant="outline" className="text-xs shrink-0">{item.mediatype}</Badge>
                      </div>
                    ))}
                    {isCollectionFetchPending && collectionPage > 1 && (
                      <div className="flex justify-center py-3" data-testid="spinner-load-more">
                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                      </div>
                    )}
                  </div>
                </ScrollArea>

                {canLoadMore && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-shrink-0"
                    onClick={() => collectionFetchMutation.mutate(collectionPage + 1)}
                    disabled={isCollectionFetchPending}
                    data-testid="button-load-more"
                  >
                    {isCollectionFetchPending && collectionPage > 1 ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Loading page {collectionPage + 1}…</>
                    ) : (
                      `Load More (page ${collectionPage + 1})`
                    )}
                  </Button>
                )}

                <div className="space-y-2 flex-shrink-0 pt-2 border-t">
                  <Label htmlFor="collection-group-title">Group Title (optional)</Label>
                  <Input
                    id="collection-group-title"
                    value={collectionGroupTitle}
                    onChange={(e) => setCollectionGroupTitle(e.target.value)}
                    placeholder="Leave blank for no group assignment"
                    data-testid="input-collection-group-title"
                  />
                </div>
              </>
            )}
          </TabsContent>

          {/* TV News tab */}
          <TabsContent value="tvnews" className="flex flex-col space-y-3 mt-4 overflow-y-auto">
                {/* Filter controls */}
                <div className="space-y-2">
                  <div className="flex gap-2 flex-wrap items-end">
                    <div className="space-y-1 min-w-36">
                      <Label htmlFor="tv-network">Network</Label>
                      <Select value={tvNetwork} onValueChange={setTvNetwork}>
                        <SelectTrigger id="tv-network" data-testid="select-tv-network">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TV_NETWORKS.map((n) => (
                            <SelectItem key={n.value} value={n.value}>{n.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1 flex-1 min-w-32">
                      <Label htmlFor="tv-query">Keyword</Label>
                      <Input
                        id="tv-query"
                        value={tvQuery}
                        onChange={(e) => setTvQuery(e.target.value)}
                        placeholder="e.g. election"
                        data-testid="input-tv-query"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !tvSearchMutation.isPending)
                            tvSearchMutation.mutate(false);
                        }}
                      />
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="tv-start-date">From</Label>
                      <Input
                        id="tv-start-date"
                        type="date"
                        value={tvStartDate}
                        onChange={(e) => setTvStartDate(e.target.value)}
                        className="w-36"
                        data-testid="input-tv-start-date"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="tv-end-date">To</Label>
                      <Input
                        id="tv-end-date"
                        type="date"
                        value={tvEndDate}
                        onChange={(e) => setTvEndDate(e.target.value)}
                        className="w-36"
                        data-testid="input-tv-end-date"
                      />
                    </div>

                    <Button
                      onClick={() => tvSearchMutation.mutate(false)}
                      disabled={tvSearchMutation.isPending}
                      data-testid="button-tv-search"
                    >
                      {tvSearchMutation.isPending && !tvItems.length ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Searching…</>
                      ) : "Search"}
                    </Button>
                  </div>

                  {tvNetwork.startsWith("__custom__") && (
                    <Input
                      value={tvCustomNetwork}
                      onChange={(e) => setTvCustomNetwork(e.target.value)}
                      placeholder="Collection slug, e.g. TV-FOXNEWSW"
                      data-testid="input-tv-custom-network"
                    />
                  )}

                  {tvHasSearched && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 flex-wrap">
                      {tvItems.length} of {tvTotal.toLocaleString()} broadcasts
                      {tvLastChecked && (
                        <span>· checked <RelativeTime date={tvLastChecked} /></span>
                      )}
                    </p>
                  )}
                </div>

                {/* Results summary */}
                {tvSearchMutation.isPending && tvItems.length === 0 ? (
                  <div className="border rounded-md p-2 space-y-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-3 p-2">
                        <Skeleton className="w-5 h-5 rounded" />
                        <Skeleton className="h-3.5 flex-1" />
                        <Skeleton className="w-16 h-3" />
                        <Skeleton className="w-20 h-3" />
                      </div>
                    ))}
                  </div>
                ) : tvHasSearched && tvItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center" data-testid="text-tv-empty">
                    No broadcasts found for this network and date range.
                  </p>
                ) : tvItems.length > 0 ? (
                  <div className="flex items-center gap-3 p-3 border rounded-md" data-testid="card-tv-summary">
                    <Tv className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">
                        <strong>{tvItems.length.toLocaleString()}</strong> of {tvTotal.toLocaleString()} broadcasts loaded
                      </p>
                      {tvSelectedIds.size > 0 && (
                        <p className="text-xs text-muted-foreground">{tvSelectedIds.size} selected</p>
                      )}
                    </div>
                    <Button size="sm" onClick={() => setTvSheetOpen(true)} data-testid="button-tv-browse">
                      Browse &amp; Select
                    </Button>
                  </div>
                ) : null}
              </TabsContent>
        </Tabs>

        <DialogFooter className="pt-4 flex-shrink-0">
          <Button variant="outline" onClick={handleClose} data-testid="button-cancel">Cancel</Button>

          {activeTab === "direct" && rssMode && rssItems.length > 0 && (
            <Button
              onClick={() => rssImportMutation.mutate()}
              disabled={rssImportMutation.isPending || rssSelectedIds.size === 0}
              data-testid="button-rss-import"
            >
              {rssImportMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Importing…</>
              ) : (
                `Import ${rssSelectedIds.size} Item${rssSelectedIds.size !== 1 ? "s" : ""}`
              )}
            </Button>
          )}

          {activeTab === "direct" && !rssMode && previewData && (
            <Button
              onClick={() => importMutation.mutate()}
              disabled={importMutation.isPending || previewData.count === 0}
              data-testid="button-import"
            >
              {importMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Importing…</>
              ) : (
                `Import ${previewData.count} Videos`
              )}
            </Button>
          )}

          {activeTab === "collection" && collectionItems.length > 0 && (
            <Button
              onClick={() => collectionImportMutation.mutate()}
              disabled={collectionImportMutation.isPending || selectedCollectionIds.size === 0}
              data-testid="button-collection-import"
            >
              {collectionImportMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Importing…</>
              ) : (
                `Import ${selectedCollectionIds.size} Item${selectedCollectionIds.size !== 1 ? "s" : ""}`
              )}
            </Button>
          )}

          {activeTab === "tvnews" && tvItems.length > 0 && (
            <Button
              onClick={() => setTvSheetOpen(true)}
              data-testid="button-tv-browse-footer"
            >
              {tvSelectedIds.size > 0
                ? `${tvSelectedIds.size} selected — Browse & Import`
                : "Browse & Select"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <TVNewsResultsSheet
      open={tvSheetOpen}
      onOpenChange={setTvSheetOpen}
      items={tvItems}
      total={tvTotal}
      isLoading={tvSearchMutation.isPending}
      canLoadMore={canTvLoadMore}
      onLoadMore={() => tvSearchMutation.mutate(true)}
      selectedIds={tvSelectedIds}
      onToggleItem={toggleTvItem}
      onToggleAll={toggleAllTv}
      allSelected={tvAllSelected}
      someSelected={tvSomeSelected}
      groupTitle={tvGroupTitle}
      onGroupTitleChange={setTvGroupTitle}
      expandSegments={tvExpandSegments}
      onExpandSegmentsChange={setTvExpandSegments}
      segmentSecs={tvSegmentSecs}
      onSegmentSecsChange={setTvSegmentSecs}
      projectedEpisodes={tvProjectedEpisodes}
      warnLargeImport={tvWarnLargeImport}
      tvLastChecked={tvLastChecked}
      onRefresh={() => tvSearchMutation.mutate(false)}
      onImport={() => tvImportMutation.mutate()}
      isImporting={tvImportMutation.isPending}
      importLabel={`Import ${tvSelectedIds.size} broadcast${tvSelectedIds.size !== 1 ? "s" : ""}`}
    />
    </>
  );
}
