import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Clock } from "lucide-react";
import type { TimeSeriesEntry } from "../../shared/schema";
import { TimeSeriesDetailSheet } from "./TimeSeriesDetailSheet";
import { TimeTravelPlayerDialog } from "./TimeTravelPlayerDialog";

interface TimeSeriesTimelineProps {
  date: Date;
}

export function TimeSeriesTimeline({ date }: TimeSeriesTimelineProps) {
  const [selectedEntry, setSelectedEntry] = useState<TimeSeriesEntry | null>(null);
  const [playerEntry, setPlayerEntry] = useState<TimeSeriesEntry | null>(null);

  const year = date.getFullYear();
  const month = date.getMonth() + 1; // 1-12
  
  const { data, isLoading } = useQuery<{ entries: TimeSeriesEntry[] }>({
    queryKey: ["/api/time-series", year, month],
    staleTime: 60000,
    retry: 1,
    queryFn: async () => {
      const res = await fetch(`/api/time-series/${year}/${month}`);
      if (!res.ok) throw new Error("Failed to load time series");
      return res.json();
    }
  });

  const entries = useMemo(() => {
    if (!data?.entries) return [];
    // Filter to the specific selected date
    return data.entries.filter(entry => {
      const d = new Date(entry.timestamp);
      return d.getFullYear() === date.getFullYear() &&
             d.getMonth() === date.getMonth() &&
             d.getDate() === date.getDate();
    }).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [data, date]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'LIVE':
      case 'PLAYING_NOW':
        return 'border-green-500 bg-green-500/20 text-green-300 shadow-[0_0_10px_rgba(34,197,94,0.3)]';
      case 'ARCHIVED':
        return 'border-emerald-700 bg-emerald-900/40 text-emerald-300';
      case 'PLAYED_YESTERDAY':
      case 'PLAYED_LAST_HOUR':
        return 'border-blue-700 bg-blue-900/40 text-blue-300';
      case 'UPCOMING_NEXT':
      case 'QUEUED_FUTURE':
        return 'border-orange-700 bg-orange-900/40 text-orange-300';
      default:
        return 'border-zinc-700 bg-zinc-800 text-zinc-400';
    }
  };

  const formattedDate = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      <div className="px-6 py-4 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between">
        <h2 className="text-lg font-bold text-zinc-200">
          Timeline: {formattedDate}
        </h2>
        <div className="text-sm text-zinc-500">
          {entries.length} broadcast files
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-6 relative">
        {/* Timeline trunk */}
        <div className="absolute left-10 top-0 bottom-0 w-px bg-zinc-800" />
        
        {isLoading ? (
          <div className="text-zinc-500 flex items-center justify-center h-40">Loading archive data...</div>
        ) : entries.length === 0 ? (
          <div className="text-zinc-500 flex flex-col items-center justify-center h-40">
            <p>No broadcast files found for this date.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {entries.map((entry, idx) => {
              const entryDate = new Date(entry.timestamp);
              const timeStr = entryDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
              
              return (
                <div key={entry.id} className="relative flex gap-6 items-start group">
                  <div className="w-20 pt-3 text-right shrink-0">
                    <span className="text-xs font-mono font-medium text-zinc-400">{timeStr}</span>
                  </div>
                  
                  {/* Timeline node */}
                  <div className="absolute left-[36px] top-4 w-3 h-3 rounded-full border-2 border-zinc-950 bg-zinc-700 group-hover:bg-emerald-500 transition-colors z-10" />
                  
                  {/* Card */}
                  <div 
                    onClick={() => setSelectedEntry(entry)}
                    className={`flex-1 border rounded-lg p-4 cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-lg ${getStatusColor(entry.status)}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-bold text-sm mb-1">{entry.title}</h3>
                        <div className="flex items-center gap-3 text-xs opacity-70">
                          {entry.duration ? <span>{Math.round(entry.duration / 60)} min</span> : null}
                          <span className="flex items-center gap-1 font-mono">
                            <Clock className="w-3 h-3" /> {entry.status.replace(/_/g, ' ')}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <TimeSeriesDetailSheet 
        entry={selectedEntry} 
        onClose={() => setSelectedEntry(null)} 
        onLaunchPlayer={(entry) => {
          setSelectedEntry(null);
          setPlayerEntry(entry);
        }}
      />

      <TimeTravelPlayerDialog 
        open={!!playerEntry} 
        onOpenChange={(open) => !open && setPlayerEntry(null)}
        url={playerEntry?.url || null}
        title={playerEntry?.title || null}
        timestamp={playerEntry?.timestamp || null}
      />
    </div>
  );
}
