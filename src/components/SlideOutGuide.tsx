import React, { useEffect, useState, useRef, useMemo } from 'react';
import { X, Tv, ChevronUp, ChevronDown, Play } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { create } from 'zustand';
import { parseArchiveUrl } from '@/src/lib/archive-parser';
import { useStaticRundown } from '@/src/hooks/useStaticRundown';

// Assuming global state for active channel
export const useActiveChannelStore = create<{
  activeNetwork: string | null;
  activeBroadcastId: string | null;
  setActiveChannel: (network: string, broadcastId: string) => void;
}>()((set) => ({
  activeNetwork: null,
  activeBroadcastId: null,
  setActiveChannel: (network, broadcastId) => set({ activeNetwork: network, activeBroadcastId: broadcastId })
}));

interface RundownData {
  network: string;
  broadcastId?: string; // Legacy
  broadcastIds?: string[];
  updatedAt: string;
}

function parseTimestamp(identifier: string): number {
  const match = identifier.match(/_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/);
  if (match) {
    const [_, year, month, day, hour, min, sec] = match;
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(min), Number(sec)));
    return date.getTime() / 1000;
  }
  return 0;
}

function ThumbnailImage({ baseThumbUrl, alt }: { baseThumbUrl: string, alt: string }) {
  return (
    <img 
      src={baseThumbUrl} 
      alt={alt}
      className="absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 bg-ajn-bg"
      onError={(e) => {
        e.currentTarget.onerror = null;
        e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiMzMzMiLz48L3N2Zz4=';
      }}
    />
  );
}

function SegmentThumbnail({ seg, nowSec }: { seg: any; nowSec: number }) {
  const isNearPlayhead = Math.abs(nowSec - seg.start) < 7200; // 2 hours

  if (!isNearPlayhead) {
    return <div className="absolute inset-0 w-full h-full bg-ajn-surface-1" />; // Placeholder for distant shows
  }

  return (
    <ThumbnailImage 
      baseThumbUrl={seg.thumbBase} 
      alt={seg.title || seg.realId} 
    />
  );
}

import { useSwipeToClose } from '@/src/hooks/useSwipeToClose';

const PIXELS_PER_SECOND = 0.5;

export function SlideOutGuide({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { rundown, loading } = useStaticRundown();
  const { activeNetwork, activeBroadcastId, setActiveChannel } = useActiveChannelStore();
  
  const timelineRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(Date.now() / 1000);

  const { handlers: swipeHandlers, style: swipeStyle } = useSwipeToClose({
    onClose,
    direction: 'right',
  });

  const intervalRef2 = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (isOpen) {
      intervalRef2.current = setInterval(() => setNow(Date.now() / 1000), 60000); // update playhead position slowly
      return () => {
        if (intervalRef2.current) clearInterval(intervalRef2.current);
      };
    }
  }, [isOpen]);

  const parsedNetworks = useMemo(() => {
    return rundown.map((net: any) => ({
      network: net.network,
      segments: net.segments || []
    }));
  }, [rundown]);

  const startOfDay = useMemo(() => {
    let min = Infinity;
    parsedNetworks.forEach(net => {
      if (net.segments.length > 0 && net.segments[0].start < min) {
        min = net.segments[0].start;
      }
    });
    // Subtract a couple of hours for padding
    return min === Infinity ? (Date.now() / 1000) - 86400 : min - 7200;
  }, [parsedNetworks]);

  const totalWidthPixels = useMemo(() => {
    let max = 0;
    parsedNetworks.forEach(net => {
      if (net.segments.length > 0) {
        const last = net.segments[net.segments.length - 1];
        if (last.start + last.duration > max) {
          max = last.start + last.duration;
        }
      }
    });
    const maxEnd = max === 0 ? startOfDay + 86400 : max + 7200;
    return (maxEnd - startOfDay) * PIXELS_PER_SECOND;
  }, [parsedNetworks, startOfDay]);

  // Center playhead on open
  useEffect(() => {
    if (isOpen && timelineRef.current && parsedNetworks.length > 0) {
      const currentNow = Date.now() / 1000;
      const targetX = (currentNow - startOfDay) * PIXELS_PER_SECOND;
      const containerWidth = timelineRef.current.clientWidth;
      
      // We want targetX to be at the center of the container
      setTimeout(() => {
        if (timelineRef.current) {
          // Instant scroll behavior
          timelineRef.current.scrollTo({ left: targetX - (containerWidth / 2), behavior: 'auto' });
        }
      }, 100);
    }
  }, [isOpen, parsedNetworks, startOfDay]);

  return (
    <>
      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity" 
            onClick={onClose}
          />
          
          {/* Slide Out Panel - Now wider for the matrix view */}
          <div
            {...swipeHandlers}
            style={swipeStyle}
            className={`fixed top-0 right-0 h-full w-full lg:w-[800px] xl:w-[1000px] bg-ajn-bg border-l border-ajn-border z-50 flex flex-col shadow-[var(--ajn-shadow-soft)] transform transition-transform duration-300 ease-in-out font-sans ${
              isOpen ? 'translate-x-0' : 'translate-x-full'
            }`}
          >
            <div className="flex items-center justify-between p-4 border-b border-ajn-border bg-ajn-surface-1">
              <div className="flex items-center gap-2">
                <Tv className="w-5 h-5 text-ajn-accent" />
                <h2 className="text-lg font-bold text-ajn-text-1 tracking-widest uppercase">Live Matrix Guide</h2>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose} className="text-ajn-text-2 hover:text-ajn-text-1 rounded-full hover:bg-ajn-surface-2 transition-colors min-h-[44px] min-w-[44px]">
                <X className="w-5 h-5" />
              </Button>
            </div>

            {loading && parsedNetworks.length === 0 ? (
               <div className="p-4 animate-pulse space-y-4">
                 {[1, 2, 3, 4].map((i) => (
                   <div key={i} className="h-14 bg-ajn-surface-2 rounded-[var(--ajn-radius-sm)] border border-ajn-border"></div>
                 ))}
               </div>
            ) : parsedNetworks.length > 0 ? (
              <div className="flex-1 w-full bg-ajn-bg border-t border-ajn-border overflow-auto relative" ref={timelineRef}>
                <div className="flex min-w-max">
                  {/* Y-AXIS: FROZEN NETWORK COLUMN */}
                  <div className="w-32 sm:w-48 flex-shrink-0 bg-ajn-surface-1 border-r border-ajn-border sticky left-0 z-40">
                    {parsedNetworks.map(net => {
                      const isNetworkActive = activeNetwork === net.network;
                      return (
                        <div key={net.network} className={`h-16 p-2 flex items-center border-b border-ajn-border ${isNetworkActive ? 'bg-ajn-surface-2 border-l-[3px] border-l-ajn-accent' : ''}`}>
                          <span className="font-bold text-xs truncate uppercase text-ajn-text-1">{net.network}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* X-AXIS: THE SCROLLING TIMELINE */}
                  <div 
                    className="relative flex-1" 
                    style={{ 
                      width: totalWidthPixels,
                      backgroundImage: 'repeating-linear-gradient(to right, var(--ajn-surface-1), var(--ajn-surface-1) 1px, transparent 1px, transparent 60px)'
                    }}
                  >
                    
                    {/* THE RED PLAYHEAD */}
                    <div className="sticky left-1/2 w-[2px] h-full bg-ajn-live shadow-[0_0_10px_var(--ajn-live)] z-30 pointer-events-none" />

                    {/* THE MATRIX LANES */}
                    <div className="absolute top-0 left-0 w-full h-full">
                      {parsedNetworks.map(net => (
                        <div key={net.network} className="h-16 flex border-b border-ajn-border relative">
                          {net.segments.map((seg, idx) => {
                            const width = seg.duration * PIXELS_PER_SECOND;
                            const leftOffset = (seg.start - startOfDay) * PIXELS_PER_SECOND;
                            const isActive = activeBroadcastId === seg.identifier;

                            return (
                              <div 
                                key={`${seg.identifier}-${idx}`}
                                className={`absolute h-14 mt-1 flex items-center bg-ajn-surface-1 border border-ajn-border rounded-[var(--ajn-radius-sm)] overflow-hidden group cursor-pointer ${
                                  isActive ? 'ring-2 ring-ajn-accent z-10 shadow-[var(--ajn-shadow-glow)]' : 'opacity-85 hover:opacity-100 hover:z-10'
                                }`}
                                style={{ width, left: leftOffset }}
                                onClick={() => {
                                  setActiveChannel(net.network, seg.identifier);
                                }}
                              >
                                <div className="h-full shrink-0 aspect-video relative border-r border-ajn-border bg-ajn-bg">
                                  <SegmentThumbnail seg={seg} nowSec={now} />
                                </div>
                                
                                <div className="flex-1 min-w-0 px-3 py-1 flex flex-col justify-center bg-ajn-surface-1">
                                  <p className="text-xs text-ajn-text-1 font-semibold truncate">{seg.title || seg.identifier}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center text-ajn-text-3 p-10 font-mono text-sm border border-dashed border-ajn-border rounded-[var(--ajn-radius-md)] m-4">
                NO NETWORKS FOUND
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}

