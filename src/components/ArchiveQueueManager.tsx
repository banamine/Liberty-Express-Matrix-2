import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { ScrollArea } from './ui/scroll-area';
import { telemetry } from '../lib/telemetry';

interface BroadcastItem {
  broadcast_id?: string;
  identifier?: string;
  title: string;
}

export function ArchiveQueueManager() {
  const [items, setItems] = useState<BroadcastItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    const fetchLatest = async () => {
      setIsLoading(true);
      try {
        const res = await fetch('/api/archive/latest');
        if (!res.ok) throw new Error('Failed to fetch latest');
        const data = await res.json();
        setItems(data);
        telemetry.info('queue', 'Fetched latest items', { count: data.length });
      } catch (e: any) {
        console.error(e);
        telemetry.error('queue', 'Failed to fetch latest items', { error: e.message });
      } finally {
        setIsLoading(false);
      }
    };
    fetchLatest();
  }, []);

  const loadOlder = async () => {
    if (isLoading || !hasMore) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/archive/deep-search?page=${currentPage}`);
      if (!res.ok) throw new Error('Failed to fetch deep search');
      const data = await res.json();
      
      const newItems = data.items.map((item: any) => ({
        broadcast_id: item.identifier,
        title: item.title,
      }));

      setItems(prev => [...prev, ...newItems]);
      setCurrentPage(data.currentPage + 1);
      setHasMore(data.hasMore);
      telemetry.info('queue', 'Fetched older items', { page: currentPage, count: newItems.length });
    } catch (e: any) {
      console.error(e);
      telemetry.error('queue', 'Failed to fetch older items', { error: e.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectAll = () => {
    const allIds = new Set(items.map(i => i.broadcast_id || i.identifier).filter(Boolean) as string[]);
    setSelectedIds(allIds);
    telemetry.debug('queue', 'Selected all items', { count: allIds.size });
  };

  const handleDeselectAll = () => {
    setSelectedIds(new Set());
    telemetry.debug('queue', 'Deselected all items');
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleIngest = () => {
    console.log("Selected IDs:", Array.from(selectedIds));
    telemetry.info('queue', 'Initiated ingest for selected items', { count: selectedIds.size, ids: Array.from(selectedIds) });
  };

  return (
    <div className="bg-black text-white p-6 rounded-xl border border-green-500/50 flex flex-col h-full min-h-[500px]">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold tracking-tight text-white">Archive Queue Manager</h2>
        <div className="flex space-x-3">
          <Button variant="outline" className="border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-900" onClick={handleSelectAll}>
            Select All
          </Button>
          <Button variant="outline" className="border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-900" onClick={handleDeselectAll}>
            Deselect All
          </Button>
          <Button 
            className="bg-green-500 hover:bg-green-400 text-black font-bold shadow-[0_0_15px_rgba(34,197,94,0.5)] border border-green-400"
            onClick={handleIngest}
          >
            INGEST SELECTED ({selectedIds.size})
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1 rounded-md border border-zinc-800 bg-[#0a0a0a]">
        <div className="p-4 space-y-2">
          {items.map((item, i) => {
            const id = item.broadcast_id || item.identifier;
            if (!id) return null;
            
            return (
              <div 
                key={`${id}-${i}`} 
                className="flex items-center space-x-4 p-3 rounded-lg hover:bg-zinc-900/50 transition-colors border border-transparent hover:border-zinc-800 group"
              >
                <Checkbox 
                  id={`checkbox-${id}-${i}`}
                  checked={selectedIds.has(id)}
                  onCheckedChange={() => toggleSelection(id)}
                  className="border-zinc-600 data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500 data-[state=checked]:text-black"
                />
                <div className="flex-1 min-w-0">
                  <label 
                    htmlFor={`checkbox-${id}-${i}`} 
                    className="text-sm font-medium cursor-pointer truncate block text-zinc-200 group-hover:text-white transition-colors"
                  >
                    {item.title}
                  </label>
                  <p className="text-xs text-zinc-500 truncate mt-0.5">{id}</p>
                </div>
              </div>
            );
          })}
          
          <div className="pt-4 flex justify-center pb-2">
            <Button 
              variant="ghost" 
              className="text-green-500 hover:text-green-400 hover:bg-green-500/10 uppercase text-xs font-bold tracking-wider"
              onClick={loadOlder}
              disabled={isLoading || !hasMore}
            >
              {isLoading ? "Loading..." : hasMore ? "Load Older" : "No more items"}
            </Button>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
