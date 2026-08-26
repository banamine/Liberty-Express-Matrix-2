import { useState, useCallback, useRef } from "react";
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
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Checkbox } from "@/src/components/ui/checkbox";
import { Badge } from "@/src/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/src/components/ui/tabs";
import { useToast } from "@/src/hooks/use-toast";
import {
  User,
  Loader2,
  ExternalLink,
  Film,
  Music,
  FileText,
  ImageIcon,
  File,
  ArrowLeft,
  Download,
  FileDown,
  Subtitles,
  Search,
  Globe,
  Link2,
  AlertCircle,
  Bookmark,
  FolderOpen,
  Mail,
  List,
  Lock,
  RefreshCw,
  PackageOpen,
  ChevronRight,
  Import,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/src/components/ui/dropdown-menu";
import { ScrollArea } from "@/src/components/ui/scroll-area";
import VirtualizedResultGrid, { type GridItem } from "./VirtualizedResultGrid";

// Change 1 — Traffic Controller: matches archive.org/details/{id} or archive.org/download/{id}
// (no trailing file path after the identifier — those are direct-file links handled by existing logic)
// Excludes @username paths — those are user profiles, not Archive.org item identifiers
const ARCHIVE_ITEM_REGEX = /archive\.org\/(details|download)\/([^@\/\s\?#][^\/\s\?#]*)/i;

interface BrowseUserDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onOpenSearch?: (query?: string) => void;
}

interface FavInfo {
  count: number;
  suggestedUploaders: Array<{ email: string; count: number; sampleTitle: string }>;
}

interface ListInfo {
  id: number;
  list_name: string;
  description: string;
  is_private: boolean;
  date_created: string;
  date_updated: string;
  identifiers: string[];
}

interface UserSearchResult {
  username: string;
  items: GridItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  pivotEmail?: string | null;
  pivotIdentifier?: string;
  note?: string;
  resolvedEmail?: string | null;
  emailNote?: string | null;
  favInfo?: FavInfo | null;
}

interface UrlDetectResult {
  type: string;
  identifier?: string;
  username?: string;
  searchQuery?: string;
  filename?: string;
  mediatype?: string;
  listId?: number;
  rssUrl?: string;
  rawInput: string;
}

interface CategorizedFile {
  identifier: string;
  filename: string;
  title: string;
  url: string;
  thumbnailUrl: string | null;
  duration: number;
  format: string;
  size: number;
  category: string;
}

interface CategorizedFiles {
  video: CategorizedFile[];
  audio: CategorizedFile[];
  document: CategorizedFile[];
  image: CategorizedFile[];
  subtitle: CategorizedFile[];
  other: CategorizedFile[];
}

interface MultiItemResult {
  categorized: CategorizedFiles;
  metadata: { identifier: string; title: string }[];
  errors: string[];
  totalFiles: number;
  imported?: number;
  message?: string;
}

type Step = "search" | "items" | "preview";

const allCategories = ["video", "audio", "document", "image", "subtitle", "other"] as const;

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

const categoryIcons: Record<string, typeof Film> = {
  video: Film,
  audio: Music,
  document: FileText,
  image: ImageIcon,
  subtitle: Subtitles,
  other: File,
};

const categoryLabels: Record<string, string> = {
  video: "Video",
  audio: "Audio",
  document: "Documents",
  image: "Images",
  subtitle: "Subtitles",
  other: "Other",
};

function buildAllFileKeys(data: MultiItemResult): Set<string> {
  const keys = new Set<string>();
  for (const cat of allCategories) {
    data.categorized[cat].forEach((_, idx) => {
      keys.add(`${cat}-${idx}`);
    });
  }
  return keys;
}

function countTotalFiles(data: MultiItemResult): number {
  let count = 0;
  for (const cat of allCategories) {
    count += data.categorized[cat].length;
  }
  return count;
}

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

function isDirectImport(input: string): boolean {
  const trimmed = input.trim();
  const isUrl = trimmed.includes('archive.org/');
  const isUserId = trimmed.startsWith('@');
  const isEmail = EMAIL_REGEX.test(trimmed);
  const isItemSlug = /^[a-zA-Z0-9_.-]+$/.test(trimmed) && !trimmed.includes(' ');
  return isUrl || isUserId || isEmail || isItemSlug;
}

export default function BrowseUserDialog({
  open = false,
  onOpenChange,
  onOpenSearch,
}: BrowseUserDialogProps) {
  const [step, setStep] = useState<Step>("search");
  const [inputValue, setInputValue] = useState("");
  const [mode, setMode] = useState<'user' | 'item'>('user');
  const [allItems, setAllItems] = useState<GridItem[]>([]);
  const [totalRemote, setTotalRemote] = useState(0);
  const [nextPage, setNextPage] = useState(2);
  const [hasMore, setHasMore] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [previewData, setPreviewData] = useState<MultiItemResult | null>(null);
  const [groupTitle, setGroupTitle] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [detectedLabel, setDetectedLabel] = useState("");
  const [inputError, setInputError] = useState("");
  const [showImportConfirm, setShowImportConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState<'uploads' | 'favorites' | 'lists'>('uploads');
  const [favItems, setFavItems] = useState<GridItem[]>([]);
  const [lists, setLists] = useState<ListInfo[]>([]);
  const [listsLoaded, setListsLoaded] = useState(false);
  const [listsError, setListsError] = useState<string | null>(null);
  const [selectedList, setSelectedList] = useState<ListInfo | null>(null);
  const [listItems, setListItems] = useState<GridItem[]>([]);
  const [listItemsLoading, setListItemsLoading] = useState(false);
  const [listItemsError, setListItemsError] = useState<string | null>(null);
  const pendingListIdRef = useRef<number | null>(null);
  const [favTotal, setFavTotal] = useState(0);
  const [favPage, setFavPage] = useState(2);
  const [favHasMore, setFavHasMore] = useState(false);
  const [favMediatype, setFavMediatype] = useState<string>('all');
  const [isLoadingAll, setIsLoadingAll] = useState(false);
  const [loadAllProgress, setLoadAllProgress] = useState("");
  const [loadCapReached, setLoadCapReached] = useState(false);
  const [directImportMode, setDirectImportMode] = useState(false);
  const [mediatypeFilter, setMediatypeFilter] = useState<string | undefined>(undefined);
  const [resolvedEmail, setResolvedEmail] = useState<string | null>(null);
  const [emailNote, setEmailNote] = useState<string | null>(null);
  const [manualEmailInput, setManualEmailInput] = useState("");
  const [favInfo, setFavInfo] = useState<FavInfo | null>(null);
  const activeUsername = useRef("");
  const activeMediatype = useRef<string | undefined>(undefined);
  const activeRssUrl = useRef<string | null>(null);
  const pendingQueryRef = useRef<string | null>(null);
  const { toast } = useToast();

  const searchMutation = useMutation({
    mutationFn: async (page: number) => {
      const input = (pendingQueryRef.current ?? inputValue).trim();
      pendingQueryRef.current = null;
      if (page === 1) activeRssUrl.current = "";

      if (!isDirectImport(input)) {
        throw new Error("KEYWORD_DETECTED");
      }

      const detectRes = await fetch("/api/archive/detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input }),
      });
      if (!detectRes.ok) throw new Error("Failed to detect input type");
      const detected = await detectRes.json() as UrlDetectResult;

      if (detected.type === 'user-list' && detected.username) {
        setMode('user');
        setDetectedLabel(`@${detected.username}`);
        activeUsername.current = detected.username;
        activeMediatype.current = undefined;
        setMediatypeFilter(undefined);
        const listId = detected.listId;
        const userResponse = await fetch("/api/archive/user", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: detected.username, page, pageSize: 100 }),
        });
        const userData: UserSearchResult = userResponse.ok ? await userResponse.json() : { username: detected.username, items: [], total: 0, page: 1, pageSize: 100, totalPages: 0 };
        return { ...userData, _pendingListId: listId };
      }

      if (detected.type === 'user-profile') {
        setMode('user');
        const isEmail = EMAIL_REGEX.test(detected.username || '');
        setDetectedLabel(isEmail ? detected.username || '' : `@${detected.username}`);
        activeUsername.current = detected.username || '';
        activeMediatype.current = detected.mediatype;
        setMediatypeFilter(detected.mediatype);
        const response = await fetch("/api/archive/user", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: detected.username,
            page,
            pageSize: 100,
            ...(detected.mediatype ? { mediatype: detected.mediatype } : {}),
          }),
        });
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Search failed");
        }
        return response.json() as Promise<UserSearchResult>;
      }

      if (detected.type === 'user-list' && detected.username) {
        setMode('user');
        const uname = detected.username;
        setDetectedLabel(`@${uname} — Lists`);
        activeUsername.current = uname;
        throw new Error(`USER_LIST:${uname}:${detected.listId ?? ''}`);
      }

      if (detected.type === 'rss-collection' && detected.rssUrl) {
        setMode('item');
        setDetectedLabel(detected.identifier || detected.rssUrl);
        activeRssUrl.current = detected.rssUrl;
        const rssRes = await fetch("/api/archive/rss-browse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rssUrl: detected.rssUrl, page, pageSize: 50 }),
        });
        if (!rssRes.ok) {
          const err = await rssRes.json();
          throw new Error(err.error || "RSS browse failed");
        }
        return rssRes.json() as Promise<UserSearchResult>;
      }

      if (detected.type === 'search') {
        throw new Error("SEARCH_URL:" + (detected.searchQuery || ''));
      }

      if (detected.type === 'item-details' || detected.type === 'download-page' || detected.type === 'direct-file') {
        const identifier = detected.identifier || '';
        setDetectedLabel(identifier);
        const pivotRes = await fetch("/api/archive/pivot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifier, page, pageSize: 100 }),
        });
        if (!pivotRes.ok) {
          const err = await pivotRes.json();
          throw new Error(err.error || "Pivot failed");
        }
        const pivotData = await pivotRes.json() as UserSearchResult;
        if (pivotData.pivotEmail) {
          setMode('user');
          setDetectedLabel(`All uploads by ${pivotData.pivotEmail}`);
          activeUsername.current = pivotData.pivotEmail;
        } else {
          setMode('item');
          setDetectedLabel(identifier);
          activeUsername.current = identifier;
        }
        return pivotData;
      }

      if (detected.type === 'rss-collection') {
        const rssUrl = detected.rssUrl || input;
        activeRssUrl.current = rssUrl;
        setMode('item');
        setDetectedLabel('RSS Collection');
        const expandRes = await fetch("/api/archive/expand-rss", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rssUrl, page: 1, pageSize: 50 }),
        });
        if (!expandRes.ok) {
          const err = await expandRes.json();
          throw new Error(err.error || "RSS scan failed");
        }
        const rssData = await expandRes.json() as { items: Array<{ identifier: string; title: string; thumbnailUrl: string; mediatype: string; isTvNews: boolean }>; total: number; page: number; totalPages: number };
        const gridItems: GridItem[] = rssData.items.map((item) => ({
          identifier: item.identifier,
          title: item.title,
          thumbnailUrl: item.thumbnailUrl,
          mediatype: item.mediatype,
          creator: '',
          downloads: 0,
          description: item.isTvNews ? 'TV News' : '',
          date: '',
        }));
        return {
          username: 'rss',
          items: gridItems,
          total: rssData.total,
          page: rssData.page,
          pageSize: 50,
          totalPages: rssData.totalPages,
        } as UserSearchResult;
      }

      throw new Error("Unrecognized input. Use a URL, @username, or item identifier.");
    },
    onSuccess: (data: UserSearchResult & { _pendingListId?: number }, page) => {
      setInputError("");
      if (page === 1) {
        setAllItems(data.items);
        setResolvedEmail(data.resolvedEmail ?? null);
        setEmailNote(data.emailNote ?? null);
        setFavInfo(data.favInfo ?? null);

        if (data._pendingListId !== undefined) {
          setActiveTab('lists');
          pendingListIdRef.current = data._pendingListId;
          loadListsMutation.mutate();
        } else if (data.items.length === 0 && data.favInfo && data.favInfo.count > 0) {
          if (favItems.length === 0) {
            loadFavoritesMutation.mutate({ page: 1, mediatype: favMediatype });
          }
        }
      } else {
        setAllItems((prev) => {
          const existingIds = new Set(prev.map((i) => i.identifier));
          const newItems = data.items.filter((i) => !existingIds.has(i.identifier));
          return [...prev, ...newItems];
        });
      }
      setTotalRemote(data.total);
      setNextPage(data.page + 1);
      setHasMore(data.page < data.totalPages);
      if (mode === 'item' && data.items.length === 1 && page === 1) {
        setSelectedItems(new Set([data.items[0].identifier]));
      }
      setStep("items");
    },
    onError: (error: Error) => {
      if (error.message === "KEYWORD_DETECTED") {
        setInputError("keyword");
        return;
      }
      if (error.message.startsWith("SEARCH_URL:")) {
        const query = error.message.slice("SEARCH_URL:".length);
        onOpenChange?.(false);
        onOpenSearch?.(query);
        return;
      }
      if (error.message.startsWith("USER_LIST:")) {
        const parts = error.message.split(":");
        const uname = parts[1] || "";
        const listIdStr = parts[2] || "";
        const autoId = listIdStr ? parseInt(listIdStr, 10) : undefined;
        activeUsername.current = uname;
        if (autoId && !isNaN(autoId)) pendingListIdRef.current = autoId;
        setStep("items");
        setActiveTab('lists');
        setListsLoaded(false);
        loadListsMutation.mutate();
        return;
      }
      toast({
        title: "Import failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const loadMoreMutation = useMutation({
    mutationFn: async (page: number) => {
      // Route through the RSS browse endpoint when a RSS collection URL is active.
      if (activeRssUrl.current) {
        const response = await fetch("/api/archive/rss-browse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rssUrl: activeRssUrl.current, page, pageSize: 50 }),
        });
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Load more failed");
        }
        return response.json() as Promise<UserSearchResult>;
      }
      const response = await fetch("/api/archive/user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: activeUsername.current,
          page,
          pageSize: 100,
          ...(activeMediatype.current ? { mediatype: activeMediatype.current } : {}),
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Load more failed");
      }
      return response.json() as Promise<UserSearchResult>;
    },
    onSuccess: (data) => {
      setAllItems((prev) => {
        const existingIds = new Set(prev.map((i) => i.identifier));
        const newItems = data.items.filter((i) => !existingIds.has(i.identifier));
        return [...prev, ...newItems];
      });
      setNextPage(data.page + 1);
      setHasMore(data.page < data.totalPages);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to load more",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const loadMoreRssMutation = useMutation({
    mutationFn: async (page: number) => {
      const rssUrl = activeRssUrl.current;
      const response = await fetch("/api/archive/expand-rss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rssUrl, page, pageSize: 50 }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Load more failed");
      }
      return response.json() as Promise<{ items: Array<{ identifier: string; title: string; thumbnailUrl: string; mediatype: string; isTvNews: boolean }>; total: number; page: number; totalPages: number }>;
    },
    onSuccess: (data) => {
      setAllItems((prev) => {
        const existingIds = new Set(prev.map((i) => i.identifier));
        const newItems = data.items
          .filter((i) => !existingIds.has(i.identifier))
          .map((item) => ({
            identifier: item.identifier,
            title: item.title,
            thumbnailUrl: item.thumbnailUrl,
            mediatype: item.mediatype,
            creator: '',
            downloads: 0,
            description: item.isTvNews ? 'TV News' : '',
            date: '',
          }));
        return [...prev, ...newItems];
      });
      setNextPage(data.page + 1);
      setHasMore(data.page < data.totalPages);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to load more",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const loadFavoritesMutation = useMutation({
    mutationFn: async ({ page, mediatype }: { page: number; mediatype: string }) => {
      const username = activeUsername.current;
      const params = new URLSearchParams({ page: String(page), pageSize: '50', mediatype });
      const response = await fetch(`/api/archive/user/${encodeURIComponent(username)}/favorites?${params}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to load favorites");
      }
      return response.json() as Promise<UserSearchResult & { favCollectionId: string }>;
    },
    onSuccess: (data, { page }) => {
      if (page === 1) {
        setFavItems(data.items);
      } else {
        setFavItems(prev => {
          const existingIds = new Set(prev.map(i => i.identifier));
          const newItems = data.items.filter(i => !existingIds.has(i.identifier));
          return [...prev, ...newItems];
        });
      }
      setFavTotal(data.total);
      setFavPage(data.page + 1);
      setFavHasMore(data.page < data.totalPages);
    },
    onError: (error: Error) => {
      toast({ title: "Failed to load favorites", description: error.message, variant: "destructive" });
    },
  });

  const loadListsMutation = useMutation({
    mutationFn: async () => {
      const username = activeUsername.current;
      const response = await fetch(`/api/archive/list/${encodeURIComponent(username)}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to load lists");
      }
      return response.json() as Promise<{ success: boolean; lists?: ListInfo[]; error?: string }>;
    },
    onSuccess: (data) => {
      if (data.success && data.lists) {
        setLists(data.lists);
        setListsError(null);
      } else {
        setListsError(data.error || "Failed to load lists");
      }
      setListsLoaded(true);
      const pendingId = pendingListIdRef.current;
      if (pendingId !== null && data.lists) {
        const found = data.lists.find(l => l.id === pendingId);
        if (found && !found.is_private) {
          setSelectedList(found);
          loadListItemsMutation.mutate(found);
        }
        pendingListIdRef.current = null;
      }
    },
    onError: (error: Error) => {
      setListsError(error.message || "Failed to load lists");
      setListsLoaded(true);
    },
  });

  const loadListItemsMutation = useMutation({
    mutationFn: async (list: ListInfo) => {
      const username = activeUsername.current;
      const response = await fetch("/api/archive/list/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifiers: list.identifiers, listId: list.id, username }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to load list items");
      }
      return response.json() as Promise<{ success: boolean; items: GridItem[] }>;
    },
    onMutate: () => {
      setListItemsLoading(true);
      setListItemsError(null);
      setListItems([]);
    },
    onSuccess: (data) => {
      setListItems(data.items || []);
      setListItemsLoading(false);
    },
    onError: (error: Error) => {
      setListItemsError(error.message || "Failed to load list items");
      setListItemsLoading(false);
    },
  });

  const importAllFromListMutation = useMutation({
    mutationFn: async () => {
      if (!selectedList) throw new Error("No list selected");
      const available = listItems.filter(i => i.mediatype !== 'unavailable');
      if (available.length === 0) throw new Error("No importable items in this list");
      const response = await fetch("/api/archive/import-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: available.map(item => ({
            identifier: item.identifier,
            title: item.title,
            description: item.description || '',
            mediatype: item.mediatype,
            date: item.date,
            creator: item.creator || '',
            downloads: item.downloads,
            thumbnailUrl: item.thumbnailUrl,
          })),
          groupTitle: selectedList.list_name || groupTitle || undefined,
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
        title: "Import complete",
        description: data.message || `Imported ${data.imported} items from list`,
      });
      handleClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Import failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const previewMutation = useMutation({
    mutationFn: async () => {
      const identifiers = Array.from(selectedItems);
      const response = await fetch("/api/archive/user/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifiers }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Preview failed");
      }
      return response.json() as Promise<MultiItemResult>;
    },
    onSuccess: (data) => {
      setPreviewData(data);
      setSelectedFiles(buildAllFileKeys(data));
      setStep("preview");
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to load files",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const quickImportMutation = useMutation({
    mutationFn: async () => {
      const sourceItems = activeTab === 'favorites' ? favItems : activeTab === 'lists' ? listItems : allItems;
      const selected = sourceItems.filter((item) =>
        selectedItems.has(item.identifier) && item.mediatype !== 'unavailable'
      );
      if (selected.length === 0) throw new Error("No items selected");
      const response = await fetch("/api/archive/import-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: selected.map(item => ({
            identifier: item.identifier,
            title: item.title,
            description: item.description || '',
            mediatype: item.mediatype,
            date: item.date,
            creator: item.creator || '',
            downloads: item.downloads,
            item_count: 0,
            thumbnailUrl: item.thumbnailUrl,
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
      setShowImportConfirm(false);
      queryClient.invalidateQueries({ queryKey: ["/api/episodes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/episodes/groups"] });
      toast({
        title: "Import complete",
        description: data.message || `Imported ${data.imported} items to workbench`,
      });
      handleClose();
    },
    onError: (error: Error) => {
      setShowImportConfirm(false);
      toast({
        title: "Import failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!previewData) throw new Error("No preview data");
      const selected = getSelectedFiles(previewData);
      if (selected.length === 0) throw new Error("No files selected");
      const response = await fetch("/api/archive/import-selected", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          files: selected,
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
        title: "Import complete",
        description: data.message || `Imported ${data.imported} files to workbench`,
      });
      handleClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Import failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Change 3 — directItemMutation: targeted scraper for specific item URLs
  // Bypasses the uploader pivot and fetches only the files inside one Archive.org item.
  const directItemMutation = useMutation({
    mutationFn: async (identifier: string) => {
      const response = await fetch("/api/archive/user/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifiers: [identifier] }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to fetch item files");
      }
      return response.json() as Promise<MultiItemResult>;
    },
    onSuccess: (data) => {
      setInputError("");
      searchMutation.reset();
      setDirectImportMode(true);
      setPreviewData(data);
      setSelectedFiles(buildAllFileKeys(data));
      setStep("preview");
    },
    onError: (error: Error) => {
      toast({ title: "Import failed", description: error.message, variant: "destructive" });
    },
  });

  const handleClose = useCallback(() => {
    setStep("search");
    setInputValue("");
    setMode('user');
    setDetectedLabel("");
    setAllItems([]);
    setTotalRemote(0);
    setNextPage(2);
    setHasMore(false);
    setLoadCapReached(false);
    setSelectedItems(new Set());
    setPreviewData(null);
    setGroupTitle("");
    setSelectedFiles(new Set());
    setShowImportConfirm(false);
    setInputError("");
    setDirectImportMode(false);
    setActiveTab('uploads');
    setFavItems([]);
    setFavTotal(0);
    setFavPage(2);
    setFavHasMore(false);
    setFavMediatype('all');
    setLists([]);
    setListsLoaded(false);
    setListsError(null);
    setSelectedList(null);
    setListItems([]);
    setListItemsLoading(false);
    setListItemsError(null);
    pendingListIdRef.current = null;
    setIsLoadingAll(false);
    setLoadAllProgress("");
    setResolvedEmail(null);
    setEmailNote(null);
    setManualEmailInput("");
    setFavInfo(null);
    setListItems([]);
    setListItemsLoading(false);
    setListItemsError(null);
    pendingQueryRef.current = null;
    activeUsername.current = "";
    activeMediatype.current = undefined;
    activeRssUrl.current = null;
    setMediatypeFilter(undefined);
    onOpenChange?.(false);
  }, [onOpenChange]);

  // Change 4 — unified loading state (DRY: used by button + loading indicator)
  const isProcessing = searchMutation.isPending || directItemMutation.isPending;

  // Change 5 — Traffic Controller: intercept direct item URLs before the greedy pivot
  const handleSearch = () => {
    if (!inputValue.trim()) return;

    const itemMatch = inputValue.trim().match(ARCHIVE_ITEM_REGEX);
    if (itemMatch) {
      const identifier = itemMatch[2];
      setInputError("");
      directItemMutation.reset();
      setSelectedItems(new Set());
      setAllItems([]);
      setLoadCapReached(false);
      setPreviewData(null);
      setDirectImportMode(false);
      setMode('item');
      setDetectedLabel(identifier);
      activeUsername.current = identifier;
      directItemMutation.mutate(identifier);
      return;
    }

    // Existing flow: @username, email, bare identifier, keyword search
    setInputError("");
    setDirectImportMode(false);
    activeMediatype.current = undefined;
    activeRssUrl.current = null;
    setMediatypeFilter(undefined);
    setSelectedItems(new Set());
    setAllItems([]);
    setLoadCapReached(false);
    setActiveTab('uploads');
    setFavItems([]);
    setFavTotal(0);
    setFavPage(2);
    setFavHasMore(false);
    setFavMediatype('all');
    setLists([]);
    setListsLoaded(false);
    setListsError(null);
    setSelectedList(null);
    setListItems([]);
    setListItemsLoading(false);
    setListItemsError(null);
    pendingListIdRef.current = null;
    setIsLoadingAll(false);
    setLoadAllProgress("");
    searchMutation.mutate(1);
  };

  const handleEmailSearch = (email: string) => {
    const trimmed = email.trim();
    if (!trimmed) return;
    pendingQueryRef.current = trimmed;
    setInputValue(trimmed);
    setManualEmailInput("");
    setInputError("");
    setDirectImportMode(false);
    setMode('user');
    setSelectedItems(new Set());
    setAllItems([]);
    setLoadCapReached(false);
    setActiveTab('uploads');
    setFavItems([]);
    setFavTotal(0);
    setFavPage(2);
    setFavHasMore(false);
    setFavMediatype('all');
    setLists([]);
    setListsLoaded(false);
    setListsError(null);
    setSelectedList(null);
    setListItems([]);
    setListItemsLoading(false);
    setListItemsError(null);
    pendingListIdRef.current = null;
    setIsLoadingAll(false);
    setLoadAllProgress("");
    setResolvedEmail(null);
    setEmailNote(null);
    setFavInfo(null);
    searchMutation.mutate(1);
  };

  const handleLoadMore = useCallback(() => {
    if (hasMore) {
      if (activeRssUrl.current) {
        if (!loadMoreRssMutation.isPending) loadMoreRssMutation.mutate(nextPage);
      } else {
        if (!loadMoreMutation.isPending) loadMoreMutation.mutate(nextPage);
      }
    }
  }, [loadMoreMutation.isPending, loadMoreRssMutation.isPending, hasMore, nextPage]);

  const LOAD_CAP = 10_000;

  const handleLoadAll = useCallback(async () => {
    if (isLoadingAll || !hasMore) return;
    setIsLoadingAll(true);
    setLoadCapReached(false);
    let page = nextPage;
    let loadedSoFar = allItems.length;
    try {
      while (true) {
        setLoadAllProgress(`${loadedSoFar.toLocaleString()} / ${Math.min(totalRemote, LOAD_CAP).toLocaleString()}`);
        const response = await fetch("/api/archive/user", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: activeUsername.current, page, pageSize: 100 }),
        });
        if (!response.ok) break;
        const data: UserSearchResult = await response.json();
        const newBatch = data.items;
        loadedSoFar += newBatch.length;
        setAllItems((prev) => {
          const existingIds = new Set(prev.map((i) => i.identifier));
          return [...prev, ...newBatch.filter((i) => !existingIds.has(i.identifier))];
        });
        if (loadedSoFar >= LOAD_CAP) {
          setLoadCapReached(true);
          break;
        }
        if (data.page >= data.totalPages) {
          setHasMore(false);
          setNextPage(data.page + 1);
          break;
        }
        page = data.page + 1;
        setNextPage(page);
      }
    } finally {
      setIsLoadingAll(false);
      setLoadAllProgress("");
    }
  }, [isLoadingAll, hasMore, nextPage, allItems.length, totalRemote]);

  const toggleFile = (key: string) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const toggleCategoryAll = (cat: string) => {
    if (!previewData) return;
    const files = previewData.categorized[cat as keyof CategorizedFiles];
    const catKeys = files.map((_, idx) => `${cat}-${idx}`);
    const allSelected = catKeys.every((k) => selectedFiles.has(k));
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        catKeys.forEach((k) => next.delete(k));
      } else {
        catKeys.forEach((k) => next.add(k));
      }
      return next;
    });
  };

  const selectAll = () => {
    if (!previewData) return;
    setSelectedFiles(buildAllFileKeys(previewData));
  };

  const deselectAll = () => {
    setSelectedFiles(new Set());
  };

  const getCategoryCounts = (cat: CategorizedFiles) => ({
    video: cat.video.length,
    audio: cat.audio.length,
    document: cat.document.length,
    image: cat.image.length,
    subtitle: cat.subtitle.length,
    other: cat.other.length,
  });

  const getSelectedFiles = (data: MultiItemResult): CategorizedFile[] => {
    const result: CategorizedFile[] = [];
    for (const cat of allCategories) {
      data.categorized[cat].forEach((file, idx) => {
        if (selectedFiles.has(`${cat}-${idx}`)) {
          result.push(file);
        }
      });
    }
    return result;
  };

  const triggerDownload = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement("a");
    a.href = url;
    a.download = filename;
    window.document.body.appendChild(a);
    a.click();
    window.document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  const exportAsM3U = () => {
    if (!previewData) return;
    const files = getSelectedFiles(previewData);
    let m3u = "#EXTM3U\n";
    for (const file of files) {
      const duration = file.duration > 0 ? file.duration : -1;
      const title = file.title || file.filename;
      let extinf = `#EXTINF:${duration}`;
      if (file.identifier) extinf += ` tvg-id="${file.identifier}"`;
      if (title) extinf += ` tvg-name="${title}"`;
      if (file.thumbnailUrl) extinf += ` tvg-logo="${file.thumbnailUrl}"`;
      if (file.category) extinf += ` group-title="${file.category}"`;
      extinf += `,${title}`;
      m3u += extinf + "\n" + file.url + "\n";
    }
    const prefix = previewData.metadata?.[0]?.identifier || "archive-export";
    triggerDownload(m3u, `${prefix}.m3u`, "audio/x-mpegurl");
    const total = countTotalFiles(previewData);
    toast({ title: "Exported M3U", description: `${files.length} of ${total} entries exported` });
  };

  const exportAsJSON = () => {
    if (!previewData) return;
    const files = getSelectedFiles(previewData);
    const exportData = {
      exportedAt: new Date().toISOString(),
      source: "Archive.org",
      items: previewData.metadata,
      totalFiles: files.length,
      categories: {
        video: previewData.categorized.video.length,
        audio: previewData.categorized.audio.length,
        document: previewData.categorized.document.length,
        image: previewData.categorized.image.length,
        subtitle: previewData.categorized.subtitle.length,
        other: previewData.categorized.other.length,
      },
      files: files.map(f => ({
        filename: f.filename,
        title: f.title,
        url: f.url,
        category: f.category,
        format: f.format,
        size: f.size,
        duration: f.duration,
        identifier: f.identifier,
        thumbnailUrl: f.thumbnailUrl,
      })),
    };
    const json = JSON.stringify(exportData, null, 2);
    const prefix = previewData.metadata?.[0]?.identifier || "archive-export";
    triggerDownload(json, `${prefix}.json`, "application/json");
    const total = countTotalFiles(previewData);
    toast({ title: "Exported JSON", description: `${files.length} of ${total} files exported` });
  };

  const exportAsHTML = () => {
    if (!previewData) return;
    const selected = getSelectedFiles(previewData);
    const total = countTotalFiles(previewData);
    const prefix = previewData.metadata?.[0]?.identifier || "Archive.org Export";
    let html = `<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n<title>${prefix} - File List</title>\n<style>\nbody { font-family: monospace; background: #0a0a0a; color: #e0e0e0; padding: 20px; }\nh1 { color: #ff0000; }\nh2 { color: #ffff00; border-bottom: 1px solid #333; padding-bottom: 4px; }\na { color: #00ff00; text-decoration: none; }\na:hover { text-decoration: underline; }\n.file { padding: 2px 0; }\n.meta { color: #888; font-size: 0.85em; margin-left: 8px; }\n.count { color: #ffff00; }\n</style>\n</head>\n<body>\n`;
    html += `<h1>${prefix}</h1>\n`;
    html += `<p>Exported: ${new Date().toLocaleString()} | Total files: <span class="count">${selected.length}</span></p>\n`;
    for (const cat of allCategories) {
      const catFiles: CategorizedFile[] = [];
      previewData.categorized[cat].forEach((file, idx) => {
        if (selectedFiles.has(`${cat}-${idx}`)) {
          catFiles.push(file);
        }
      });
      if (catFiles.length === 0) continue;
      html += `<h2>${categoryLabels[cat]} <span class="count">(${catFiles.length})</span></h2>\n<ul>\n`;
      for (const f of catFiles) {
        const title = f.title || f.filename;
        const meta = [f.format, f.size > 0 ? formatSize(f.size) : null, f.duration > 0 ? formatDuration(f.duration) : null].filter(Boolean).join(" | ");
        html += `<li class="file"><a href="${f.url}" target="_blank">${title}</a>${meta ? `<span class="meta">[${meta}]</span>` : ""}</li>\n`;
      }
      html += `</ul>\n`;
    }
    html += `</body>\n</html>`;
    triggerDownload(html, `${prefix}.html`, "text/html");
    toast({ title: "Exported HTML", description: `${selected.length} of ${total} files exported` });
  };

  const exportAsTXT = () => {
    if (!previewData) return;
    const selected = getSelectedFiles(previewData);
    const total = countTotalFiles(previewData);
    const prefix = previewData.metadata?.[0]?.identifier || "Archive.org Export";
    let txt = `${prefix}\n${"=".repeat(prefix.length)}\n`;
    txt += `Exported: ${new Date().toLocaleString()}\nTotal files: ${selected.length}\n\n`;
    for (const cat of allCategories) {
      const catFiles: CategorizedFile[] = [];
      previewData.categorized[cat].forEach((file, idx) => {
        if (selectedFiles.has(`${cat}-${idx}`)) {
          catFiles.push(file);
        }
      });
      if (catFiles.length === 0) continue;
      txt += `--- ${categoryLabels[cat]} (${catFiles.length}) ---\n`;
      for (const f of catFiles) {
        const title = f.title || f.filename;
        txt += `${title}\n  ${f.url}\n`;
      }
      txt += "\n";
    }
    triggerDownload(txt, `${prefix}.txt`, "text/plain");
    toast({ title: "Exported TXT", description: `${selected.length} of ${total} files exported` });
  };

  const totalFileCount = previewData ? countTotalFiles(previewData) : 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col"
        data-testid="dialog-browse-user"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5" />
            Direct Import
          </DialogTitle>
          <DialogDescription>
            Import from Archive.org using a URL, @username, email address, or item identifier. For keyword searches, use the Search tool.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {step === "search" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="browse-input">URL, @username, email, or item ID</Label>
                <div className="flex gap-2">
                  <Input
                    id="browse-input"
                    value={inputValue}
                    onChange={(e) => {
                      setInputValue(e.target.value);
                      setInputError("");
                    }}
                    placeholder="e.g. @username, uploader@email.com, or https://archive.org/details/..."
                    className="flex-1"
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    data-testid="input-browse-archive"
                  />
                  <Button
                    onClick={handleSearch}
                    disabled={!inputValue.trim() || isProcessing}
                    data-testid="button-search-archive"
                  >
                    {isProcessing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4 mr-2" />
                    )}
                    {isProcessing ? "" : "Import"}
                  </Button>
                </div>

                {isProcessing && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="text-search-loading">
                    <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" />
                    <span>
                      {directItemMutation.isPending
                        ? <>Fetching files from <span className="font-mono text-foreground/80">{activeUsername.current}</span>…</>
                        : /collection-rss\.php/i.test(inputValue)
                        ? <>Scanning Collection RSS for Playable Clips…</>
                        : <>Searching Archive.org for{" "}
                            <span className="font-mono text-foreground/80">{inputValue.trim()}</span>
                            {EMAIL_REGEX.test(inputValue.trim()) ? "" : " — discovering uploads via email pivot..."}
                          </>
                      }
                    </span>
                  </div>
                )}

                {inputError === "keyword" && (
                  <div className="flex items-start gap-2 p-3 rounded-md bg-muted border text-sm" data-testid="text-keyword-nudge">
                    <AlertCircle className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-foreground">That looks like a keyword search.</p>
                      <p className="text-muted-foreground mt-0.5">
                        This tool is for direct imports only (URLs, @usernames, item IDs).
                      </p>
                      {onOpenSearch && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-2"
                          onClick={() => {
                            const query = inputValue.trim();
                            handleClose();
                            onOpenSearch(query);
                          }}
                          data-testid="button-go-to-search"
                        >
                          <Search className="w-3.5 h-3.5 mr-1.5" />
                          Open Keyword Search
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                <div className="text-xs text-muted-foreground space-y-1">
                  <p className="flex items-center gap-1.5">
                    <User className="w-3 h-3" /> Username: <span className="font-mono text-foreground/70">@username</span>
                  </p>
                  <p className="flex items-center gap-1.5">
                    <User className="w-3 h-3" /> Email: <span className="font-mono text-foreground/70">uploader@example.com</span>
                  </p>
                  <p className="flex items-center gap-1.5">
                    <Link2 className="w-3 h-3" /> URL: <span className="font-mono text-foreground/70">https://archive.org/details/...</span>
                  </p>
                  <p className="flex items-center gap-1.5">
                    <Film className="w-3 h-3" /> ID: <span className="font-mono text-foreground/70">my-item-identifier</span>
                  </p>
                </div>
              </div>
            </div>
          )}

          {step === "items" && (
            <>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setStep("search");
                    setAllItems([]);
                    setTotalRemote(0);
                    setHasMore(false);
                    setSelectedItems(new Set());
                  }}
                  data-testid="button-back-search"
                >
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate flex items-center gap-1.5">
                    {mode === 'user' && <User className="w-3.5 h-3.5 flex-shrink-0" />}
                    {mode === 'item' && <Link2 className="w-3.5 h-3.5 flex-shrink-0" />}
                    {detectedLabel}
                  </p>
                  {mode === 'user' && resolvedEmail && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5 flex items-center gap-1" data-testid="text-resolved-email">
                      <span className="font-mono">{resolvedEmail}</span>
                      <button
                        className="hover:text-foreground transition-colors"
                        title="Copy email"
                        onClick={() => navigator.clipboard.writeText(resolvedEmail)}
                        data-testid="button-copy-email"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                      </button>
                    </p>
                  )}
                  {mode === 'user' && !resolvedEmail && emailNote && (
                    <p className="text-xs text-amber-500/80 truncate mt-0.5" data-testid="text-email-note">
                      Email unresolved
                    </p>
                  )}
                </div>
                {mediatypeFilter && mediatypeFilter !== 'all' && (
                  <Badge variant="secondary" data-testid="badge-active-mediatype-filter">
                    {mediatypeFilter}
                  </Badge>
                )}
              </div>

              {mode === 'user' ? (
                <Tabs
                  value={activeTab}
                  onValueChange={(v) => {
                    const tab = v as 'uploads' | 'favorites' | 'lists';
                    setActiveTab(tab);
                    setSelectedItems(new Set());
                    if (tab === 'favorites' && favItems.length === 0 && !loadFavoritesMutation.isPending) {
                      loadFavoritesMutation.mutate({ page: 1, mediatype: favMediatype });
                    }
                    if (tab === 'lists' && !listsLoaded && !loadListsMutation.isPending) {
                      loadListsMutation.mutate();
                    }
                  }}
                  className="flex-1 flex flex-col overflow-hidden"
                >
                  <TabsList className="w-full justify-start flex-shrink-0" data-testid="tabs-user-browse">
                    <TabsTrigger value="uploads" className="gap-1.5 text-xs" data-testid="tab-uploads">
                      <User className="w-3 h-3" />
                      Uploads
                      {totalRemote > 0 && (
                        <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4 ml-1">
                          {totalRemote}
                        </Badge>
                      )}
                    </TabsTrigger>
                    <TabsTrigger
                      value="favorites"
                      className="gap-1.5 text-xs"
                      data-testid="tab-favorites"
                    >
                      <Bookmark className="w-3 h-3" />
                      Favorites
                      {favTotal > 0 && (
                        <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4 ml-1">
                          {favTotal}
                        </Badge>
                      )}
                    </TabsTrigger>
                    <TabsTrigger
                      value="lists"
                      className="gap-1.5 text-xs"
                      data-testid="tab-lists"
                    >
                      <List className="w-3 h-3" />
                      Lists
                      {lists.length > 0 && (
                        <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4 ml-1">
                          {lists.length}
                        </Badge>
                      )}
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="uploads" className="flex-1 flex flex-col overflow-hidden mt-0 pt-2">
                    {allItems.length === 0 && !searchMutation.isPending && !loadMoreMutation.isPending ? (
                      <div className="flex flex-col items-center justify-center py-10 text-center gap-3 px-4" data-testid="empty-state-uploads">
                        <User className="w-8 h-8 text-muted-foreground/30" />
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-foreground/80">No uploads found</p>
                          <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
                            {favInfo && favInfo.count > 0
                              ? `No uploads found, but they have ${favInfo.count} favorited item${favInfo.count === 1 ? '' : 's'} — see the Favorites tab.`
                              : emailNote
                                ? emailNote
                                : 'This user has no public uploads on Archive.org.'}
                          </p>
                        </div>
                        {favInfo && favInfo.suggestedUploaders.length > 0 && (
                          <div className="flex flex-col items-center gap-2 w-full max-w-xs" data-testid="suggested-uploaders">
                            <p className="text-xs text-muted-foreground">
                              Their favorites were uploaded by:
                            </p>
                            <div className="flex flex-wrap gap-1.5 justify-center">
                              {favInfo.suggestedUploaders.slice(0, 5).map((su) => (
                                <Button
                                  key={su.email}
                                  size="sm"
                                  variant="outline"
                                  className="gap-1.5 text-xs"
                                  data-testid={`button-explore-uploader-${su.email}`}
                                  onClick={() => handleEmailSearch(su.email)}
                                >
                                  <Mail className="w-3 h-3" />
                                  {su.email}
                                  {su.count > 1 && (
                                    <Badge variant="secondary" className="ml-0.5 text-[10px] px-1 py-0">
                                      {su.count}
                                    </Badge>
                                  )}
                                </Button>
                              ))}
                            </div>
                          </div>
                        )}
                        {mode === 'user' && (
                          <div className="flex flex-col items-center gap-2 w-full max-w-xs">
                            <p className="text-xs text-muted-foreground">
                              If you know their Archive.org email, search with it directly:
                            </p>
                            <div className="flex gap-2 w-full">
                              <Input
                                data-testid="input-manual-email"
                                placeholder="uploader@example.com"
                                value={manualEmailInput}
                                onChange={(e) => setManualEmailInput(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && manualEmailInput.trim()) {
                                    handleEmailSearch(manualEmailInput);
                                  }
                                }}
                                className="h-8 text-xs"
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                data-testid="button-search-by-email"
                                disabled={!manualEmailInput.trim() || searchMutation.isPending}
                                onClick={() => handleEmailSearch(manualEmailInput)}
                              >
                                Search
                              </Button>
                            </div>
                          </div>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-1 gap-1.5"
                          data-testid="button-check-favorites"
                          onClick={() => {
                            setActiveTab('favorites');
                            if (favItems.length === 0 && !loadFavoritesMutation.isPending) {
                              loadFavoritesMutation.mutate({ page: 1, mediatype: favMediatype });
                            }
                          }}
                        >
                          <Bookmark className="w-3.5 h-3.5" />
                          {favInfo && favInfo.count > 0
                            ? `View ${favInfo.count} Favorite${favInfo.count === 1 ? '' : 's'}`
                            : 'Check Favorites instead'}
                        </Button>
                      </div>
                    ) : (
                      <VirtualizedResultGrid
                        items={allItems}
                        selectedItems={selectedItems}
                        onSelectionChange={setSelectedItems}
                        totalRemote={totalRemote}
                        isLoadingMore={loadMoreMutation.isPending}
                        hasMore={hasMore}
                        onLoadMore={handleLoadMore}
                        onLoadAll={handleLoadAll}
                        isLoadingAll={isLoadingAll}
                        loadAllProgress={loadAllProgress}
                        loadCapReached={loadCapReached}
                        nextPage={nextPage}
                      />
                    )}
                  </TabsContent>

                  <TabsContent value="favorites" className="flex-1 overflow-hidden mt-0 flex flex-col gap-2 pt-2">
                    <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap">
                      <span className="text-xs text-muted-foreground">Filter:</span>
                      {(['all', 'movies', 'audio', 'texts', 'image'] as const).map((mt) => (
                        <button
                          key={mt}
                          onClick={() => {
                            if (mt === favMediatype) return;
                            setFavMediatype(mt);
                            setFavItems([]);
                            setFavPage(2);
                            setFavHasMore(false);
                            setSelectedItems(new Set());
                            loadFavoritesMutation.mutate({ page: 1, mediatype: mt });
                          }}
                          data-testid={`btn-fav-filter-${mt}`}
                          className={`text-xs px-2 py-0.5 rounded-sm border transition-colors ${
                            favMediatype === mt
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'border-border text-muted-foreground hover-elevate'
                          }`}
                        >
                          {mt === 'all' ? 'All' : mt.charAt(0).toUpperCase() + mt.slice(1)}
                        </button>
                      ))}
                      {loadFavoritesMutation.isPending && favItems.length === 0 && (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground ml-1" />
                      )}
                    </div>
                    {!loadFavoritesMutation.isPending && favItems.length === 0 && (
                      <div className="flex-1 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                        <Bookmark className="w-8 h-8 opacity-30" />
                        <p className="text-sm">No bookmarked items found</p>
                        <p className="text-xs opacity-60">This user has no public favorites collection</p>
                      </div>
                    )}
                    {favItems.length > 0 && (
                      <VirtualizedResultGrid
                        items={favItems}
                        selectedItems={selectedItems}
                        onSelectionChange={setSelectedItems}
                        totalRemote={favTotal}
                        isLoadingMore={loadFavoritesMutation.isPending && favItems.length > 0}
                        hasMore={favHasMore}
                        onLoadMore={() => {
                          if (!loadFavoritesMutation.isPending && favHasMore) {
                            loadFavoritesMutation.mutate({ page: favPage, mediatype: favMediatype });
                          }
                        }}
                        headerLabel={`Bookmarked items · ${favTotal.toLocaleString()} total`}
                        headerIcon={<FolderOpen className="w-3.5 h-3.5" />}
                      />
                    )}
                  </TabsContent>

                  <TabsContent value="lists" className="flex-1 overflow-hidden mt-0 flex flex-col gap-2 pt-2">
                    {loadListsMutation.isPending && (
                      <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground" data-testid="loading-lists">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <p className="text-sm">Loading lists…</p>
                      </div>
                    )}
                    {!loadListsMutation.isPending && listsError && (
                      <div className="flex flex-col items-center justify-center py-10 gap-3 text-center" data-testid="error-lists">
                        <AlertCircle className="w-6 h-6 text-destructive/60" />
                        <div className="space-y-1">
                          <p className="text-sm font-medium">Failed to load lists</p>
                          <p className="text-xs text-muted-foreground">{listsError}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5"
                          data-testid="button-retry-lists"
                          onClick={() => {
                            setListsLoaded(false);
                            setListsError(null);
                            loadListsMutation.mutate();
                          }}
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          Try again
                        </Button>
                      </div>
                    )}
                    {!loadListsMutation.isPending && !listsError && listsLoaded && lists.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground" data-testid="empty-lists">
                        <List className="w-8 h-8 opacity-30" />
                        <p className="text-sm">No public lists found</p>
                        <p className="text-xs opacity-60">This user has no public curated lists</p>
                      </div>
                    )}
                    {!loadListsMutation.isPending && !listsError && lists.length > 0 && (
                      <div className="flex flex-1 overflow-hidden gap-3">
                        <div className="w-48 flex-shrink-0 flex flex-col overflow-hidden">
                          <ScrollArea className="flex-1">
                            <div className="space-y-0.5 pr-1">
                              {lists.map((list) => (
                                <button
                                  key={list.id}
                                  data-testid={`list-item-${list.id}`}
                                  disabled={list.is_private}
                                  onClick={() => {
                                    if (list.is_private) return;
                                    setSelectedList(list);
                                    setSelectedItems(new Set());
                                    loadListItemsMutation.mutate(list);
                                  }}
                                  className={`w-full text-left px-2 py-2 rounded-md text-xs transition-colors ${
                                    list.is_private
                                      ? 'opacity-50 cursor-not-allowed text-muted-foreground'
                                      : selectedList?.id === list.id
                                        ? 'bg-primary text-primary-foreground'
                                        : 'text-foreground hover-elevate'
                                  }`}
                                >
                                  <div className="flex items-center gap-1.5">
                                    {list.is_private ? (
                                      <Lock className="w-3 h-3 flex-shrink-0" />
                                    ) : (
                                      <ChevronRight className="w-3 h-3 flex-shrink-0 opacity-50" />
                                    )}
                                    <span className="truncate font-medium">{list.list_name}</span>
                                  </div>
                                  <div className="mt-0.5 pl-[18px] text-xs opacity-60">
                                    {list.is_private ? 'Private' : `${list.identifiers.length} item${list.identifiers.length !== 1 ? 's' : ''}`}
                                  </div>
                                </button>
                              ))}
                            </div>
                          </ScrollArea>
                        </div>
                        <div className="flex-1 flex flex-col overflow-hidden">
                          {!selectedList && (
                            <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground" data-testid="list-select-prompt">
                              <PackageOpen className="w-8 h-8 opacity-20" />
                              <p className="text-sm">Select a list to view its items</p>
                            </div>
                          )}
                          {selectedList && listItemsLoading && (
                            <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground" data-testid="loading-list-items">
                              <Loader2 className="w-5 h-5 animate-spin" />
                              <p className="text-sm">Loading items…</p>
                            </div>
                          )}
                          {selectedList && !listItemsLoading && listItemsError && (
                            <div className="flex flex-col items-center justify-center h-full gap-3 text-center" data-testid="error-list-items">
                              <AlertCircle className="w-6 h-6 text-destructive/60" />
                              <div className="space-y-1">
                                <p className="text-sm font-medium">Failed to load items</p>
                                <p className="text-xs text-muted-foreground">{listItemsError}</p>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1.5"
                                data-testid="button-retry-list-items"
                                onClick={() => {
                                  if (selectedList) loadListItemsMutation.mutate(selectedList);
                                }}
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                                Try again
                              </Button>
                            </div>
                          )}
                          {selectedList && !listItemsLoading && !listItemsError && listItems.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground" data-testid="empty-list-items">
                              <PackageOpen className="w-8 h-8 opacity-20" />
                              <p className="text-sm">This list is empty</p>
                            </div>
                          )}
                          {selectedList && !listItemsLoading && !listItemsError && listItems.length > 0 && (
                            <div className="flex flex-col overflow-hidden h-full gap-1">
                              <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                                <p className="text-xs text-muted-foreground flex-1">
                                  <span className="font-medium text-foreground">{selectedList.list_name}</span>
                                  {" · "}{listItems.length} item{listItems.length !== 1 ? 's' : ''}
                                </p>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="gap-1.5 text-xs"
                                  data-testid="button-select-all-list"
                                  onClick={() => {
                                    const available = listItems.filter(i => i.mediatype !== 'unavailable');
                                    setSelectedItems(new Set(available.map(i => i.identifier)));
                                  }}
                                >
                                  Select all available
                                </Button>
                                <Button
                                  size="sm"
                                  variant="default"
                                  className="gap-1.5 text-xs"
                                  data-testid="button-import-all-list"
                                  disabled={importAllFromListMutation.isPending}
                                  onClick={() => importAllFromListMutation.mutate()}
                                >
                                  {importAllFromListMutation.isPending ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <Import className="w-3 h-3" />
                                  )}
                                  Import All from List
                                </Button>
                              </div>
                              <VirtualizedResultGrid
                                items={listItems}
                                selectedItems={selectedItems}
                                onSelectionChange={setSelectedItems}
                                totalRemote={listItems.length}
                                isLoadingMore={false}
                                hasMore={false}
                                onLoadMore={() => {}}
                                headerLabel={`${selectedList.list_name} · ${listItems.length} items`}
                                headerIcon={<List className="w-3.5 h-3.5" />}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              ) : (
                <VirtualizedResultGrid
                  items={allItems}
                  selectedItems={selectedItems}
                  onSelectionChange={setSelectedItems}
                  totalRemote={totalRemote}
                  isLoadingMore={loadMoreMutation.isPending || loadMoreRssMutation.isPending}
                  hasMore={hasMore}
                  onLoadMore={handleLoadMore}
                  onLoadAll={activeRssUrl.current ? undefined : handleLoadAll}
                  isLoadingAll={isLoadingAll}
                  loadAllProgress={loadAllProgress}
                  loadCapReached={loadCapReached}
                  nextPage={nextPage}
                />
              )}

              {selectedItems.size > 0 && (
                <div className="space-y-2 pt-2 border-t flex-shrink-0">
                  <div className="space-y-1">
                    <Label htmlFor="items-group-title" className="text-xs">Group Title (optional)</Label>
                    <Input
                      id="items-group-title"
                      value={groupTitle}
                      onChange={(e) => setGroupTitle(e.target.value)}
                      placeholder="Leave blank to use media type"
                      data-testid="input-items-group-title"
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="items-replace-existing"
                      data-testid="checkbox-items-replace"
                    />
                    <Label
                      htmlFor="items-replace-existing"
                      className="text-xs cursor-pointer"
                    >
                      Replace existing episodes (clear workbench before import)
                    </Label>
                  </div>
                </div>
              )}
            </>
          )}

          {step === "preview" && previewData && (
            <>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setPreviewData(null);
                    setSelectedFiles(new Set());
                    setStep(directImportMode ? "search" : "items");
                  }}
                  data-testid="button-back-items"
                >
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">
                    {directImportMode && previewData.metadata[0]
                      ? previewData.metadata[0].title || previewData.metadata[0].identifier
                      : `Files from ${previewData.metadata.length} item${previewData.metadata.length !== 1 ? "s" : ""}`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {previewData.totalFiles} files found
                  </p>
                </div>
                <Badge variant="secondary" data-testid="badge-selected-files">
                  {selectedFiles.size} of {totalFileCount} files selected
                </Badge>
              </div>

              <Tabs defaultValue="video" className="flex-1 overflow-hidden flex flex-col">
                <TabsList className="w-full justify-start" data-testid="tabs-file-categories">
                  {allCategories.map(
                    (cat) => {
                      const Icon = categoryIcons[cat];
                      const count = getCategoryCounts(previewData.categorized)[cat];
                      return (
                        <TabsTrigger
                          key={cat}
                          value={cat}
                          className="text-xs gap-1"
                          data-testid={`tab-${cat}`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          {categoryLabels[cat]}
                          <Badge variant="secondary" className="ml-1 text-xs">
                            {count}
                          </Badge>
                        </TabsTrigger>
                      );
                    }
                  )}
                </TabsList>

                {allCategories.map(
                  (cat) => {
                    const catFiles = previewData.categorized[cat];
                    const catKeys = catFiles.map((_, idx) => `${cat}-${idx}`);
                    const catSelectedCount = catKeys.filter((k) => selectedFiles.has(k)).length;
                    const allCatSelected = catFiles.length > 0 && catSelectedCount === catFiles.length;
                    return (
                      <TabsContent
                        key={cat}
                        value={cat}
                        className="flex-1 overflow-hidden mt-2"
                      >
                        {catFiles.length > 0 && (
                          <div className="flex items-center gap-2 pb-2" data-testid={`select-all-${cat}-row`}>
                            <Checkbox
                              checked={allCatSelected}
                              onCheckedChange={() => toggleCategoryAll(cat)}
                              data-testid={`checkbox-select-all-${cat}`}
                            />
                            <span className="text-xs text-muted-foreground">
                              {allCatSelected ? "Deselect all" : "Select all"} {categoryLabels[cat].toLowerCase()}
                            </span>
                            <Badge variant="outline" className="ml-auto text-xs" data-testid={`badge-cat-selected-${cat}`}>
                              {catSelectedCount} / {catFiles.length}
                            </Badge>
                          </div>
                        )}
                        <ScrollArea className="h-full max-h-[40vh]">
                          <div className="space-y-1 pr-3">
                            {catFiles.length === 0 ? (
                              <p className="text-sm text-muted-foreground text-center py-8">
                                No {categoryLabels[cat].toLowerCase()} files found
                              </p>
                            ) : (
                              catFiles.map((file, idx) => {
                                const Icon = categoryIcons[cat];
                                const fileKey = `${cat}-${idx}`;
                                return (
                                  <div
                                    key={`${file.identifier}-${idx}`}
                                    className="flex items-center gap-3 p-2 rounded hover-elevate cursor-pointer"
                                    onClick={() => toggleFile(fileKey)}
                                    data-testid={`file-${cat}-${idx}`}
                                  >
                                    <Checkbox
                                      checked={selectedFiles.has(fileKey)}
                                      onCheckedChange={() => toggleFile(fileKey)}
                                      onClick={(e) => e.stopPropagation()}
                                      data-testid={`checkbox-file-${cat}-${idx}`}
                                    />
                                    {file.thumbnailUrl ? (
                                      <img
                                        src={file.thumbnailUrl}
                                        alt=""
                                        className="w-12 h-8 object-cover rounded bg-muted flex-shrink-0"
                                        onError={(e) => {
                                          (e.target as HTMLImageElement).style.display =
                                            "none";
                                        }}
                                      />
                                    ) : (
                                      <div className="w-12 h-8 bg-muted rounded flex items-center justify-center flex-shrink-0">
                                        <Icon className="w-4 h-4 text-muted-foreground" />
                                      </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium truncate">
                                        {file.title}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        {file.format}
                                        {file.duration > 0 &&
                                          ` · ${formatDuration(file.duration)}`}
                                        {file.size > 0 && ` · ${formatSize(file.size)}`}
                                        {" · "}
                                        {file.identifier}
                                      </p>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </ScrollArea>
                      </TabsContent>
                    );
                  }
                )}
              </Tabs>

              {previewData.errors.length > 0 && (
                <div className="text-sm text-yellow-500 bg-yellow-500/10 p-2 rounded max-h-16 overflow-auto">
                  {previewData.errors.map((err, i) => (
                    <p key={i}>{err}</p>
                  ))}
                </div>
              )}

              <div className="space-y-3 pt-2 border-t">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={selectAll}
                    data-testid="button-select-all-files"
                  >
                    Select All
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={deselectAll}
                    data-testid="button-deselect-all-files"
                  >
                    Deselect All
                  </Button>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="browse-group-title">Group Title (optional)</Label>
                  <Input
                    id="browse-group-title"
                    value={groupTitle}
                    onChange={(e) => setGroupTitle(e.target.value)}
                    placeholder="Leave blank to use item identifiers"
                    data-testid="input-browse-group-title"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="browse-replace-existing"
                    data-testid="checkbox-browse-replace"
                  />
                  <Label
                    htmlFor="browse-replace-existing"
                    className="text-sm cursor-pointer"
                  >
                    Replace existing episodes (clear workbench before import)
                  </Label>
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="pt-4 gap-2 flex-wrap">
          <Button variant="outline" onClick={handleClose} data-testid="button-browse-cancel">
            Cancel
          </Button>

          {step === "items" && selectedItems.size > 0 && (
            <>
              <Button
                variant="outline"
                onClick={() => previewMutation.mutate()}
                disabled={previewMutation.isPending || quickImportMutation.isPending}
                data-testid="button-preview-files"
              >
                {previewMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Loading files...
                  </>
                ) : (
                  `Browse Files (${selectedItems.size})`
                )}
              </Button>
              <Button
                onClick={() => quickImportMutation.mutate()}
                disabled={quickImportMutation.isPending || previewMutation.isPending}
                data-testid="button-quick-import"
              >
                {quickImportMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Fetching {selectedItems.size} collection{selectedItems.size !== 1 ? 's' : ''}...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Import Episodes from {selectedItems.size} Collection{selectedItems.size !== 1 ? 's' : ''}
                  </>
                )}
              </Button>
            </>
          )}

          {step === "preview" && previewData && (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" data-testid="button-export-dropdown">
                    <FileDown className="w-4 h-4 mr-2" />
                    Export Links ({selectedFiles.size})
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={exportAsM3U} data-testid="button-export-m3u">
                    Export as M3U
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportAsJSON} data-testid="button-export-json">
                    Export as JSON
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportAsHTML} data-testid="button-export-html">
                    Export as HTML
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportAsTXT} data-testid="button-export-txt">
                    Export as TXT
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                onClick={() => importMutation.mutate()}
                disabled={importMutation.isPending || selectedFiles.size === 0}
                data-testid="button-import-files"
              >
                {importMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    {directImportMode && previewData?.metadata[0]
                      ? `Import ${selectedFiles.size} File${selectedFiles.size !== 1 ? "s" : ""} from ${previewData.metadata[0].title || previewData.metadata[0].identifier}`
                      : `Import ${selectedFiles.size} Files to Workbench`}
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
