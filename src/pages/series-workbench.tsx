import React, { useState, useEffect } from 'react';
import { Search, ListVideo, Layers, Save, RefreshCw, FileText, Info } from 'lucide-react';
import { toast } from 'sonner';
import { sanitizeTitle } from '../lib/title-sanitizer';

interface SeriesFile {
  title: string;
  filename: string;
  path: string;
  url: string;
  sizeMB: number;
  format: string;
  durationSec?: number;
  thumbnailUrl?: string;
  sanitizedTitle?: string;
}

/**
 * Pure, deterministic utility to extract the exact Archive identifier slug.
 * Safely parses clean IDs, download links, details paths, and trailing slashes.
 */
function extractArchiveIdentifier(input: string): string {
  if (!input) return '';
  let sanitized = input.trim().replace(/\/+$/, '');
  
  const archiveUrlPattern = /archive\.org\/(?:details|download|metadata|embed)\/([^\/\?#]+)/i;
  const match = sanitized.match(archiveUrlPattern);
  
  if (match && match[1]) {
    return match[1];
  }
  
  if (sanitized.includes('://')) {
    const parts = sanitized.split('/');
    return parts[parts.length - 1] || '';
  }
  
  return sanitized;
}

export default function SeriesWorkbench() {
  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<SeriesFile[]>([]);
  const [isQueueing, setIsQueueing] = useState(false);
  const [minSize, setMinSize] = useState(50);
  const [minDuration, setMinDuration] = useState(600);
  const [thumbnails, setThumbnails] = useState<any[]>([]);
  const [metadata, setMetadata] = useState<any>(null);
  const [metadataLoading, setMetadataLoading] = useState(false);

  // Extract the target clean ID string for data operations
  const activeIdentifier = extractArchiveIdentifier(identifier);

  useEffect(() => {
    if (!activeIdentifier) {
      setMetadata(null);
      return;
    }

    const fetchQueued = async () => {
      try {
        const res = await fetch(`/api/archive/holding-queue?identifier=${activeIdentifier}`);
        if (res.ok) {
          const data = await res.json();
          if (data.items && data.items.length > 0) {
            const queuedFiles = data.items.map((item: any) => {
               let title = item.filename;
               try {
                 const p = JSON.parse(item.pendingEpisodeJson || '{}');
                 if (p.title) title = p.title;
               } catch (e) {}
               return {
                 title: title,
                 sanitizedTitle: title,
                 filename: item.filename,
                 path: '',
                 url: `https://archive.org/download/${item.identifier}/${item.filename}`,
                 sizeMB: item.fileSizeBytes ? (item.fileSizeBytes / (1024 * 1024)) : ((() => { try { return JSON.parse(item.pendingEpisodeJson || "{}").sizeMB || 0 } catch(e) { return 0 } })()),
                 format: (() => { try { return JSON.parse(item.pendingEpisodeJson || "{}").format || "Unknown" } catch(e) { return "Unknown" } })(),
                 queued: true,
                 status: item.status
               };
            });
            setFiles(prev => prev.length === 0 ? queuedFiles : prev);
          }
        }
      } catch (err) {}
    };
    fetchQueued();

    const timer = setTimeout(async () => {
      setMetadataLoading(true);
      try {
        const res = await fetch(`https://archive.org/metadata/${activeIdentifier}`);
        if (!res.ok) throw new Error('Metadata fetch failed');
        const data = await res.json();
        
        // Archive returns an empty metadata object for invalid identifiers
        if (data.metadata && Object.keys(data.metadata).length > 0) {
          setMetadata(data.metadata);
        } else {
          setMetadata(null);
        }
      } catch (err) {
        setMetadata(null);
      } finally {
        setMetadataLoading(false);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [activeIdentifier]);

  const handleCrawl = async () => {
    if (!activeIdentifier) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/archive/series-crawl/${activeIdentifier}?minSize=${minSize}&minDuration=${minDuration}`);
      
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Target endpoint did not return valid JSON metadata.");
      }
      
      if (!res.ok) throw new Error('Failed to crawl series');
      const data = await res.json();
      
      const sanitizedFiles = data.files.map((f: any) => ({
        ...f,
        sanitizedTitle: sanitizeTitle(f.title)
      }));

      setFiles(sanitizedFiles);

      toast.success(`Found ${sanitizedFiles.length} valid media files`);
    } catch (err: any) {
      toast.error(err.message.includes("Unexpected token") ? "Invalid data source format selected." : err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleQueueAll = async () => {
    if (!files.length || !activeIdentifier || isQueueing) return;
    setIsQueueing(true);
    try {
      const payload = {
        items: files.map(f => ({
          identifier: activeIdentifier,
          filename: f.filename,
          title: f.sanitizedTitle || f.title,
          thumbnailUrl: f.thumbnailUrl || `https://archive.org/services/img/${activeIdentifier}`,
          sizeMB: f.sizeMB,
          format: f.format
        })),
        groupTitle: activeIdentifier
      };
      const res = await fetch('/api/archive/import-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Failed to queue');
      const data = await res.json();
      toast.success(data.message || 'Added series to holding queue');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Classic Series Workbench</h2>
          <p className="text-muted-foreground mt-2">
            Deep-crawl Archive.org identifiers for long-form TV series and movies, resolve thumbnail mappings, and clean titles.
          </p>
        </div>
      </div>

      <div className="flex gap-4 items-end bg-card p-4 rounded-xl border">
        <div className="flex-1">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Archive Identifier</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input 
              type="text" 
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="e.g. 1a-1-1a-bc or full Archive URL"
              className="w-full bg-background border rounded-md py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>
        <div className="w-24">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Min Size (MB)</label>
          <input 
            type="number" 
            value={minSize}
            onChange={(e) => setMinSize(parseInt(e.target.value) || 0)}
            className="w-full bg-background border rounded-md py-2 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="w-24">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Min Secs</label>
          <input 
            type="number" 
            value={minDuration}
            onChange={(e) => setMinDuration(parseInt(e.target.value) || 0)}
            className="w-full bg-background border rounded-md py-2 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <button 
          onClick={handleCrawl}
          disabled={loading || !activeIdentifier}
          className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 py-2 disabled:opacity-50"
        >
          {loading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <ListVideo className="mr-2 h-4 w-4" />}
          Crawl Series
        </button>
      </div>

      {metadataLoading ? (
        <div className="bg-card/50 border rounded-xl p-4 flex items-center gap-3 animate-pulse">
          <div className="w-16 h-16 bg-muted rounded-md" />
          <div className="space-y-2 flex-1">
            <div className="h-4 bg-muted rounded w-1/3" />
            <div className="h-3 bg-muted rounded w-1/4" />
          </div>
        </div>
      ) : metadata ? (
        <div className="bg-card border rounded-xl p-4 flex flex-col sm:flex-row gap-4 items-start shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
            <Info className="w-32 h-32" />
          </div>
          <div className="w-16 h-16 sm:w-24 sm:h-24 shrink-0 bg-muted rounded-md overflow-hidden border">
            <img 
              src={`https://archive.org/services/img/${activeIdentifier}`} 
              alt="cover" 
              className="w-full h-full object-cover" 
              referrerPolicy="no-referrer"
              onError={(e) => (e.currentTarget.style.display = 'none')}
            />
          </div>
          <div className="flex-1 min-w-0 z-10">
            <h3 className="font-semibold text-lg truncate" title={metadata.title}>
              {metadata.title || 'Unknown Title'}
            </h3>
            <div className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
              <span className="bg-muted/50 px-2 py-0.5 rounded text-xs">{metadata.mediatype || 'collection'}</span>
              {metadata.creator && <span>• {Array.isArray(metadata.creator) ? metadata.creator[0] : metadata.creator}</span>}
              {metadata.date && <span>• {String(metadata.date).substring(0, 4)}</span>}
            </div>
            {metadata.description && (
              <p 
                className="text-sm mt-3 line-clamp-2 text-muted-foreground/80 leading-relaxed max-w-4xl" 
              >
                {String(metadata.description)}
              </p>
            )}
          </div>
        </div>
      ) : null}

      {files.length > 0 && (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="p-4 border-b bg-muted/20 font-semibold flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              <span>Discovered Episodes ({files.length})</span>
            </div>
            <button onClick={handleQueueAll} disabled={isQueueing} className="inline-flex items-center justify-center rounded-md text-xs font-medium transition-colors bg-secondary text-secondary-foreground hover:bg-secondary/80 disabled:opacity-50 h-7 px-3">
              <Save className="mr-2 h-3 w-3" />
              Send to Queue
            </button>
          </div>
          <div className="divide-y max-h-[600px] overflow-y-auto">
            {files.map((file, i) => (
              <div key={i} className="p-4 flex gap-4 hover:bg-muted/10 transition-colors">
                <div className="w-32 h-20 bg-muted/30 rounded-md overflow-hidden shrink-0 flex items-center justify-center border relative">
                  <img 
                    src={file.thumbnailUrl || `https://archive.org/services/img/${activeIdentifier}`} 
                    alt="thumb" 
                    className="object-cover w-full h-full" 
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = 'none';
                      const fallback = (e.currentTarget as HTMLImageElement).parentElement?.querySelector('.fallback-icon');
                      if (fallback) fallback.classList.remove('hidden');
                    }}
                  />
                  <div className="hidden fallback-icon absolute inset-0 flex items-center justify-center pointer-events-none">
                    <FileText className="h-6 w-6 text-muted-foreground opacity-50" />
                  </div>
                  <div className="absolute top-1 left-1 bg-black/70 text-[10px] text-white px-1.5 py-0.5 rounded">
                    E{i + 1}
                  </div>
                </div>
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <div className="font-semibold text-sm truncate" title={file.sanitizedTitle}>
                    {file.sanitizedTitle}
                  </div>
                  <div className="text-xs text-muted-foreground truncate mt-1" title={file.filename}>
                    Raw: {file.filename}
                  </div>
                  <div className="flex gap-3 mt-2 text-xs font-mono text-muted-foreground">
                    <span className="bg-muted/50 px-1.5 rounded">{file.sizeMB.toFixed(1)} MB</span>
                    <span className="bg-muted/50 px-1.5 rounded">{file.format}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
