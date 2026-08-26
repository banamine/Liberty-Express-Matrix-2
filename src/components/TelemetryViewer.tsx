import { useState, useEffect } from 'react';
import { X, Filter, RefreshCcw } from 'lucide-react';
import { telemetry, TelemetryEvent, LogLevel, LogCategory } from '../lib/telemetry';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { ScrollArea } from './ui/scroll-area';

interface TelemetryViewerProps {
  onClose: () => void;
}

export function TelemetryViewer({ onClose }: TelemetryViewerProps) {
  const [events, setEvents] = useState<TelemetryEvent[]>([]);
  const [levelFilter, setLevelFilter] = useState<LogLevel | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<LogCategory | 'all'>('all');
  const [timeFilter, setTimeFilter] = useState<string>('all');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const fetchEvents = () => {
    setEvents(telemetry.getEvents().reverse());
  };

  useEffect(() => {
    fetchEvents();
    if (autoRefresh) {
      const unsubscribe = telemetry.subscribe(fetchEvents);
      return unsubscribe;
    }
  }, [autoRefresh]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const filteredEvents = events.filter(e => {
    if (levelFilter !== 'all' && e.level !== levelFilter) return false;
    if (categoryFilter !== 'all' && e.category !== categoryFilter) return false;
    
    if (timeFilter !== 'all') {
      const now = Date.now();
      const diff = now - e.timestamp;
      if (timeFilter === '5m' && diff > 5 * 60 * 1000) return false;
      if (timeFilter === '15m' && diff > 15 * 60 * 1000) return false;
      if (timeFilter === '1h' && diff > 60 * 60 * 1000) return false;
      if (timeFilter === '24h' && diff > 24 * 60 * 60 * 1000) return false;
    }
    
    return true;
  });

  const exportTelemetry = () => {
    const csv = [
      ['Timestamp', 'Level', 'Category', 'Message', 'Data'].join(','),
      ...filteredEvents.map(e => [
        new Date(e.timestamp).toISOString(),
        e.level,
        e.category,
        `"${e.message.replace(/"/g, '""')}"`,
        e.data ? `"${JSON.stringify(e.data).replace(/"/g, '""')}"` : ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `telemetry-${new Date().toISOString().slice(0, 19)}.csv`;
    link.click();
  };

  const getLevelColor = (level: LogLevel) => {
    switch (level) {
      case 'error': return 'text-red-500 bg-red-500/10';
      case 'warn': return 'text-amber-500 bg-amber-500/10';
      case 'info': return 'text-blue-500 bg-blue-500/10';
      case 'debug': return 'text-slate-500 bg-slate-500/10';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-card w-full max-w-5xl h-[80vh] rounded-xl border flex flex-col shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b bg-muted/30">
          <h2 className="text-xl font-bold flex items-center gap-2" title="Events older than 24 hours are automatically purged">
            <span className="font-mono text-primary">{'<>'}</span>
            Telemetry Debug Viewer <span className="text-sm font-normal text-muted-foreground ml-2">(Showing last 24h)</span>
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-4 p-4 border-b bg-muted/10">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={levelFilter} onValueChange={(v: any) => setLevelFilter(v)}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="error">Error</SelectItem>
                <SelectItem value="warn">Warn</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="debug">Debug</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Select value={categoryFilter} onValueChange={(v: any) => setCategoryFilter(v)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="search">Search</SelectItem>
              <SelectItem value="queue">Queue</SelectItem>
              <SelectItem value="playback">Playback</SelectItem>
              <SelectItem value="system">System</SelectItem>
              <SelectItem value="network">Network</SelectItem>
              <SelectItem value="ui">UI</SelectItem>
            </SelectContent>
          </Select>

          <Select value={timeFilter} onValueChange={(v: string) => setTimeFilter(v)}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Time Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="5m">Last 5 min</SelectItem>
              <SelectItem value="15m">Last 15 min</SelectItem>
              <SelectItem value="1h">Last hour</SelectItem>
              <SelectItem value="24h">Last 24 hours</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2 ml-auto">
            <div className="text-sm text-muted-foreground mr-2">
              {filteredEvents.length} of {events.length} events
            </div>
            <Label htmlFor="auto-refresh" className="text-sm font-medium cursor-pointer">
              Auto-refresh
            </Label>
            <Switch
              id="auto-refresh"
              checked={autoRefresh}
              onCheckedChange={setAutoRefresh}
            />
            {!autoRefresh && (
              <Button variant="outline" size="icon" onClick={fetchEvents} className="ml-2 h-9 w-9">
                <RefreshCcw className="h-4 w-4" />
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={exportTelemetry} className="ml-2">
              Export CSV
            </Button>
            <Button variant="destructive" size="sm" onClick={() => setShowClearConfirm(true)} className="ml-2">
              Clear Logs
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1 p-4 bg-black/40 font-mono text-sm">
          {filteredEvents.length === 0 ? (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              No events found.
            </div>
          ) : (
            <div className="space-y-1">
              {filteredEvents.map((event) => (
                <div key={event.id} className="group flex flex-col py-2 border-b border-white/5 hover:bg-white/5 transition-colors px-2 rounded-md">
                  <div className="flex items-start gap-3">
                    <span className="text-muted-foreground shrink-0 w-24">
                      {new Date(event.timestamp).toLocaleTimeString([], { hour12: false, fractionalSecondDigits: 3 })}
                    </span>
                    <span className={`shrink-0 w-16 px-1.5 py-0.5 rounded text-xs font-medium text-center uppercase ${getLevelColor(event.level)}`}>
                      {event.level}
                    </span>
                    <span className="text-primary/70 shrink-0 w-20 truncate" title={event.category}>
                      [{event.category}]
                    </span>
                    <span className="text-foreground break-words flex-1">
                      {event.message}
                    </span>
                  </div>
                  {event.data && (
                    <div className="mt-1 ml-[11rem] p-2 bg-black/60 rounded text-muted-foreground whitespace-pre-wrap break-all text-xs border border-white/5">
                      {JSON.stringify(event.data, null, 2)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {showClearConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-card p-6 rounded-lg border shadow-lg max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold mb-2">Clear Telemetry</h3>
            <p className="text-sm text-muted-foreground mb-6">Are you sure you want to clear all telemetry logs? This cannot be undone.</p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowClearConfirm(false)}>Cancel</Button>
              <Button 
                variant="destructive" 
                onClick={() => { 
                  telemetry.clear(); 
                  fetchEvents(); 
                  setShowClearConfirm(false);
                }}
              >
                Clear All
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}