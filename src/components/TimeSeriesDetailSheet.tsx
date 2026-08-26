import React from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/src/components/ui/sheet";
import { Button } from "@/src/components/ui/button";
import { Play, Calendar, ExternalLink, HardDrive } from "lucide-react";
import type { TimeSeriesEntry } from "../../shared/schema";

interface TimeSeriesDetailSheetProps {
  entry: TimeSeriesEntry | null;
  onClose: () => void;
  onLaunchPlayer: (entry: TimeSeriesEntry) => void;
}

export function TimeSeriesDetailSheet({ entry, onClose, onLaunchPlayer }: TimeSeriesDetailSheetProps) {
  if (!entry) return null;

  const formattedTime = new Date(entry.timestamp).toLocaleString(undefined, { 
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', 
    hour: '2-digit', minute: '2-digit' 
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'LIVE':
      case 'PLAYING_NOW':
        return 'text-green-400 bg-green-500/10 border-green-500/20';
      case 'ARCHIVED':
        return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      case 'PLAYED_YESTERDAY':
      case 'PLAYED_LAST_HOUR':
        return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
      case 'UPCOMING_NEXT':
      case 'QUEUED_FUTURE':
        return 'text-orange-400 bg-orange-500/10 border-orange-500/20';
      default:
        return 'text-zinc-400 bg-zinc-800 border-zinc-700';
    }
  };

  return (
    <Sheet open={!!entry} onOpenChange={onClose}>
      <SheetContent className="w-[400px] sm:w-[500px] border-l border-zinc-800 bg-zinc-950 p-0 flex flex-col shadow-2xl">
        <SheetHeader className="px-6 py-6 border-b border-zinc-800 bg-zinc-900/50">
          <SheetTitle className="text-xl font-bold text-zinc-100 flex items-start gap-3 text-left">
            <HardDrive className="w-6 h-6 text-emerald-500 mt-1 shrink-0" />
            <span className="leading-tight">{entry.title}</span>
          </SheetTitle>
          <div className="flex items-center gap-2 mt-4">
            <span className={`px-2.5 py-0.5 rounded text-xs font-semibold border uppercase tracking-wider ${getStatusColor(entry.status)}`}>
              {entry.status.replace(/_/g, ' ')}
            </span>
          </div>
        </SheetHeader>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-sm">
          <div className="space-y-4">
            <div>
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" /> Broadcast Time
              </span>
              <p className="text-zinc-200 bg-zinc-900 px-3 py-2 rounded-md border border-zinc-800">
                {formattedTime}
              </p>
            </div>
            
            {entry.duration && entry.duration > 0 ? (
              <div>
                <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                   Duration
                </span>
                <p className="text-zinc-200 bg-zinc-900 px-3 py-2 rounded-md border border-zinc-800">
                  {Math.round(entry.duration / 60)} minutes
                </p>
              </div>
            ) : null}

            <div>
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <ExternalLink className="w-3.5 h-3.5" /> Source Media URL
              </span>
              <p className="text-zinc-400 bg-zinc-900 px-3 py-2 rounded-md border border-zinc-800 break-all font-mono text-xs">
                {entry.url}
              </p>
            </div>
            
            {entry.metadata && Object.keys(entry.metadata).length > 0 && (
              <div>
                <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1.5 block">
                   Additional Metadata
                </span>
                <pre className="text-zinc-400 bg-zinc-900 p-3 rounded-md border border-zinc-800 overflow-x-auto text-xs font-mono">
                  {JSON.stringify(entry.metadata, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>

        <div className="p-6 border-t border-zinc-800 bg-zinc-900/80 mt-auto flex flex-col gap-3">
          <p className="text-xs text-zinc-500 text-center mb-1">
            Initiate time-travel playback from this exact point in the archive.
          </p>
          <Button 
            onClick={() => onLaunchPlayer(entry)}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-12 rounded-lg transition-all flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(5,150,105,0.3)] hover:shadow-[0_0_25px_rgba(5,150,105,0.5)]"
          >
            <Play className="w-5 h-5 fill-current" />
            Launch in Archive Player
          </Button>
          <Button 
            variant="outline" 
            onClick={onClose}
            className="w-full border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
          >
            Close Details
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
