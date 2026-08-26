import { useState, useEffect, useRef } from 'react';
import { Search, Archive, Download, RefreshCw, Plus, X, Check } from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import { telemetry } from '../lib/telemetry';

interface Episode {
  identifier: string;
  title: string;
  mediatype?: string;
  date?: string;
  source?: string;
  collection?: string[];
  episode_count?: number;
  runtime?: number;
  description?: string;
}

interface QueueItem {
  id: string;
  identifier: string;
  title: string;
  thumbnail: string;
  metadata: {
    collection?: string[];
    episodeCount?: number;
    runtime?: number;
  };
  timestamp: number;
}

// ✅ NEW: Reusable image component with proper error handling and metadata fetching
function ArchiveImage({ 
  identifier, 
  alt, 
  className,
  fallback = '/placeholder-thumbnail.svg'
}: { 
  identifier: string; 
  alt: string; 
  className?: string;
  fallback?: string;
}) {
  const defaultSrc = `https://archive.org/services/img/${identifier}`;
  const [imageSrc, setImageSrc] = useState(defaultSrc);
  const [hasError, setHasError] = useState(false);

  const handleError = () => {
    if (!hasError) {
      console.warn(`Failed to load image for: ${identifier}`);
      setImageSrc(fallback);
      setHasError(true);
    }
  };

  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const img = e.currentTarget;
    if (img.naturalWidth <= 1 && img.naturalHeight <= 1) {
      handleError();
    }
  };

  return (
    <img 
      src={imageSrc}
      alt={alt}
      className={className}
      loading="lazy"
      onError={handleError}
      onLoad={handleLoad}
    />
  );
}

function EpisodeCard({ 
  episode, 
  onAddToQueue, 
  isQueued 
}: { 
  episode: Episode; 
  onAddToQueue: (ep: Episode) => void; 
  isQueued: boolean 
}) {
  return (
    <div className="flex gap-4 p-4 border rounded-xl bg-card/50 hover:bg-card transition-colors">
      <div className="w-24 h-16 bg-muted rounded-md overflow-hidden flex-shrink-0 relative">
        <ArchiveImage
          identifier={episode.identifier}
          alt={episode.title}
          className="w-full h-full object-cover"
        />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-semibold text-sm truncate" title={episode.title}>
          {episode.title}
        </h4>
        <p className="text-xs text-muted-foreground mt-1 truncate">
          ID: {episode.identifier}
        </p>
        {episode.date && (
          <p className="text-xs text-muted-foreground mt-1">
            {new Date(episode.date).toLocaleDateString()}
          </p>
        )}
      </div>
      <div className="flex items-center justify-center">
        <button 
          onClick={() => onAddToQueue(episode)}
          disabled={isQueued}
          className={`inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors h-8 px-3 ${
            isQueued 
              ? 'bg-muted text-muted-foreground cursor-not-allowed' 
              : 'bg-primary text-primary-foreground hover:bg-primary/90'
          }`}
          title={isQueued ? "Added to Queue" : "Add to Queue"}
        >
          {isQueued ? (
            <>
              <Check className="h-4 w-4 mr-1.5" />
              Added
            </>
          ) : (
            <>
              <Plus className="h-4 w-4 mr-1.5" />
              Queue
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function HoldingQueuePanel({ 
  items, 
  onRemove, 
  onProcess,
  onClear,
  isProcessing 
}: { 
  items: QueueItem[]; 
  onRemove: (id: string) => void; 
  onProcess: (items: QueueItem[]) => void;
  onClear: () => void;
  isProcessing: boolean 
}) {
  return (
    <div className="rounded-xl border bg-card overflow-hidden flex flex-col h-full max-h-[600px]">
      <div className="p-4 border-b bg-muted/20 font-semibold flex items-center justify-between flex-shrink-0">
        <span>Holding Queue</span>
        <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
          {items.length} pending
        </span>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4">
        {items.length === 0 ? (
          <div className="text-center text-muted-foreground flex-1 flex flex-col items-center justify-center h-full min-h-[200px]">
            <Download className="h-12 w-12 text-muted mb-4" />
            <p>Queue is empty.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map(item => (
              <div key={item.id} className="flex gap-3 p-3 border rounded-xl bg-card group">
                <div className="w-20 h-14 bg-muted rounded-md overflow-hidden flex-shrink-0 relative">
                  <ArchiveImage
                    identifier={item.identifier}
                    alt={item.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm truncate" title={item.title}>
                    {item.title}
                  </h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    {item.metadata.episodeCount ? `${item.metadata.episodeCount} episodes` : ''}
                  </p>
                </div>
                
                <button 
                  onClick={() => onRemove(item.id)}
                  className="text-muted-foreground hover:text-destructive p-1 rounded transition-colors self-start opacity-0 group-hover:opacity-100"
                  title="Remove"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      
      <div className="p-4 border-t bg-muted/10 flex-shrink-0 flex gap-2">
        <button 
          onClick={onClear}
          className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors bg-destructive text-destructive-foreground hover:bg-destructive/90 h-9 px-4 py-2"
        >
          Clear Workspace
        </button>
        <button 
          onClick={() => onProcess(items)}
          disabled={items.length === 0 || isProcessing}
          className="flex-1 inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${isProcessing ? 'animate-spin' : ''}`} />
          Process Queue ({items.length})
        </button>
      </div>
    </div>
  );
}

export default function ArchiveQueue() {
  const [query, setQuery] = useState('');

  const handleQuickClear = async () => {
    try {
      const response = await fetch('/api/archive/holding-queue', { 
        method: 'DELETE' 
      });
      
      if (response.ok) {
        setHoldingQueue([]); 
        toast({ title: "Workspace cleared successfully.", variant: "default" });
      } else {
        throw new Error("Backend failed to clear.");
      }
    } catch (error) {
      console.error("Clear failed:", error);
      toast({ title: "Failed to clear workspace.", variant: "destructive" });
    }
  };
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Episode[]>([]);
  const [holdingQueue, setHoldingQueue] = useState<QueueItem[]>([]);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    let active = true;
    const fetchQueue = () => {
      fetch('/api/archive/holding-queue')
        .then(res => res.json())
        .then(data => {
          if (!active) return;
          if (data && data.items) {
            const queueItems = data.items.map((item: any) => {
              let metadata: any = {};
              try { 
                metadata = JSON.parse(item.pendingEpisodeJson || '{}');
              } catch(e){}
              return {
                id: item.id ? item.id.toString() : `${item.identifier}-${Math.random().toString(36).substring(7)}`,
                identifier: item.identifier,
                title: metadata.title || item.identifier,
                thumbnail: item.thumbnailUrl || metadata.thumbnailUrl,
                metadata: {
                  ...metadata,
                  sizeMB: metadata.sizeMB || (item.fileSizeBytes ? item.fileSizeBytes / (1024*1024) : 0),
                  format: item.format || metadata.format
                }
              };
            });
            setHoldingQueue(queueItems);
          }
        })
        .catch(console.error);
    };

    fetchQueue();
    intervalRef.current = setInterval(fetchQueue, 3000);
    return () => {
      active = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const [searchHistory, setSearchHistory] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('ajn-search-history');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('ajn-search-history', JSON.stringify(searchHistory));
  }, [searchHistory]);

  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const handleSearch = async (e?: React.FormEvent, explicitQuery?: string) => {
    e?.preventDefault();
    const searchQuery = explicitQuery !== undefined ? explicitQuery : query;
    if (!searchQuery.trim()) return;
    
    // Update search history
    setSearchHistory(prev => {
      const newHistory = [searchQuery, ...prev.filter(q => q !== searchQuery)].slice(0, 10);
      return newHistory;
    });

    setQuery(searchQuery);
    setIsSearching(true);
    telemetry.info('search', 'Initiated search', { query: searchQuery });
    try {
      const res = await fetch(`/api/archive/search?q=${encodeURIComponent(searchQuery)}`);
      if (!res.ok) throw new Error('Search failed');
      const data = await res.json();
      setSearchResults(data.items || []);
      telemetry.info('search', 'Search completed', { query: searchQuery, count: data.items?.length || 0 });
    } catch (error: any) {
      toast({
        title: "Search Error",
        description: error.message,
        variant: "destructive"
      });
      telemetry.error('search', 'Search failed', { query: searchQuery, error: error.message });
    } finally {
      setIsSearching(false);
    }
  };

  const handleProcessQueue = async (items: QueueItem[]) => {
    if (items.length === 0) return;
    
    setIsProcessing(true);
    telemetry.info('queue', 'Processing holding queue', { count: items.length });
    try {
      const payload = {
        items: items.map(i => ({ identifier: i.identifier, title: i.title, thumbnailUrl: i.thumbnail })),
        groupTitle: 'Manual Import'
      };
      
      const res = await fetch('/api/archive/import-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!res.ok) throw new Error('Failed to process queue');
      
      const data = await res.json();
      toast({
        title: "Success",
        description: data.message || `Queued ${items.length} items for ingestion.`
      });
      
      setHoldingQueue([]);
      telemetry.info('queue', 'Successfully processed holding queue', { count: items.length });
    } catch (error: any) {
      toast({
        title: "Import Error",
        description: error.message,
        variant: "destructive"
      });
      telemetry.error('queue', 'Failed to process holding queue', { error: error.message });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-4 md:p-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Archive.org Ingestion</h2>
          <p className="text-muted-foreground mt-2">
            Search, queue, and import content from the Internet Archive directly into your library.
          </p>
        </div>
      </div>

      <div className="space-y-4 mb-6">
        <form onSubmit={handleSearch} className="flex gap-4">
          <div className="relative flex-1 max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input 
              type="text" 
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search Archive.org by keyword, identifier, or creator..."
              className="w-full bg-card border rounded-md py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <button 
            type="submit" 
            disabled={isSearching}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors bg-secondary text-secondary-foreground hover:bg-secondary/80 h-9 px-4 py-2 disabled:opacity-50"
          >
            {isSearching ? (
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Search className="mr-2 h-4 w-4" />
            )}
            Search
          </button>
        </form>

        {searchHistory.length > 0 && (
          <div className="flex flex-wrap gap-2 max-w-xl">
            {searchHistory.map((historyItem, idx) => (
              <button
                key={idx}
                onClick={() => handleSearch(undefined, historyItem)}
                className="text-xs bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground px-3 py-1 rounded-full transition-colors border"
              >
                {historyItem}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5 h-[600px]">
        <div className="rounded-xl border bg-card flex flex-col lg:col-span-3 h-full overflow-hidden">
          <div className="p-4 border-b bg-muted/20 font-semibold flex items-center justify-between flex-shrink-0">
            <span>Search Results</span>
            {searchResults.length > 0 && (
              <span className="text-xs text-muted-foreground">{searchResults.length} found</span>
            )}
          </div>
          
          <div className="flex-1 overflow-y-auto p-4">
            {searchResults.length === 0 ? (
              <div className="text-center text-muted-foreground h-full flex flex-col items-center justify-center">
                <Archive className="h-12 w-12 text-muted mb-4" />
                <p>Search to find media assets.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {searchResults.map((ep, i) => (
                  <EpisodeCard 
                    key={`${ep.identifier}-${i}`}
                    episode={ep}
                    isQueued={holdingQueue.some(item => item.identifier === ep.identifier)}
                    onAddToQueue={(ep) => {
                      setHoldingQueue([...holdingQueue, {
                        id: `${ep.identifier}-${Math.random().toString(36).substring(7)}`,
                        identifier: ep.identifier,
                        title: ep.title,
                        thumbnail: `https://archive.org/services/img/${ep.identifier}`,
                        metadata: { 
                          collection: ep.collection,
                          episodeCount: ep.episode_count,
                          runtime: ep.runtime
                        },
                        timestamp: Date.now()
                      }]);
                      telemetry.info('queue', 'Added to holding queue', { id: ep.identifier });
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 h-full">
          <HoldingQueuePanel 
            items={holdingQueue}
            onClear={handleQuickClear}
            onRemove={(id) => {
              setHoldingQueue(holdingQueue.filter(i => i.id !== id));
              telemetry.info('queue', 'Removed from holding queue', { id });
            }}
            onProcess={handleProcessQueue}
            isProcessing={isProcessing}
          />
        </div>
      </div>
    </div>
  );
}
