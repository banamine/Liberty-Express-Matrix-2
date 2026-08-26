import React, { useMemo } from 'react';
import { X, Tv, Play } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { useStaticRundown, BroadcastSegment } from '@/src/hooks/useStaticRundown';
import { parseArchiveUrl } from '@/src/lib/archive-parser';
import { useActiveChannelStore } from '@/src/components/SlideOutGuide';
import { getLiveLoopState } from '@/src/lib/live-loop';

function parseTimestamp(identifier: string): number {
  const match = identifier.match(/_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/);
  if (match) {
    const [_, year, month, day, hour, min, sec] = match;
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(min), Number(sec)));
    return date.getTime() / 1000;
  }
  return 0;
}

import { useSwipeToClose } from '@/src/hooks/useSwipeToClose';

export function MinimalSlideOutGuide({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { rundown, loading } = useStaticRundown();
  const { activeNetwork, setActiveChannel } = useActiveChannelStore();

  const { handlers: swipeHandlers, style: swipeStyle } = useSwipeToClose({
    onClose,
    direction: 'right',
  });

  const parsedNetworks = useMemo(() => {
    return rundown.map((net: any) => ({
      channelId: net.channelId,
      network: net.network,
      segments: net.segments || []
    }));
  }, [rundown]);

  return (
    <>
      {isOpen && (
        <>
          <div 
             className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity" 
             onClick={onClose}
          />
          
          <div
            {...swipeHandlers}
            style={swipeStyle}
            className={`fixed top-0 right-0 h-full w-full sm:w-[400px] bg-ajn-surface-1 border-l border-white/10 z-50 flex flex-col shadow-soft transform transition-transform duration-dur-med ease-standard ${
              isOpen ? 'translate-x-0' : 'translate-x-full'
            }`}
          >
            <div className="flex items-center justify-between p-4 border-b border-white/10 bg-ajn-surface-2">
              <div className="flex items-center gap-2">
                <Tv className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-bold text-ajn-text-1 uppercase tracking-wider">Live Channels</h2>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose} className="text-ajn-text-2 hover:text-ajn-text-1 rounded-full hover:bg-white/10 transition-colors min-h-[44px] min-w-[44px]">
                <X className="w-5 h-5" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {loading && parsedNetworks.length === 0 ? (
                <div className="animate-pulse space-y-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-24 bg-ajn-surface-2 rounded-md border border-white/10"></div>
                  ))}
                </div>
              ) : parsedNetworks.length > 0 ? (
                parsedNetworks.map(net => {
                  const { currentSegment: currentSeg } = getLiveLoopState(net.segments);
                  if (!currentSeg) return null;
                  
                  const isNetworkActive = activeNetwork === net.network;

                  return (
                    <div 
                      key={net.network} 
                      className={`relative flex items-center p-2 rounded-md border cursor-pointer transition-all ${
                        isNetworkActive ? 'bg-ajn-surface-3 border-primary ring-1 ring-primary' : 'bg-ajn-surface-2 border-white/10 hover:border-white/30 hover:bg-ajn-surface-3'
                      }`}
                      onClick={() => {
                        setActiveChannel(net.network, currentSeg.identifier);
                        onClose();
                      }}
                    >
                      <div className="w-24 h-16 bg-black rounded overflow-hidden flex-shrink-0 relative border border-white/5">
                        <img 
                          src={currentSeg.thumbBase} 
                          alt={net.network}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiMzMzMiLz48L3N2Zz4=';
                          }}
                        />
                        <div className="absolute top-1 left-1 bg-live text-black text-[9px] font-bold px-1 rounded-sm uppercase">Live</div>
                      </div>
                      
                      <div className="ml-4 flex-1 min-w-0">
                        <h3 className="font-bold text-ajn-text-1 truncate">{net.network}</h3>
                        <p className="text-[10px] font-mono text-ajn-text-3/70 truncate">{net.channelId}</p>
                        <p className="text-xs text-ajn-text-3 truncate mt-1">{currentSeg.title}</p>
                      </div>

                      <div className="ml-2 flex-shrink-0">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isNetworkActive ? 'bg-primary/20 text-primary' : 'bg-white/5 text-white/50'}`}>
                          <Play className="w-4 h-4 ml-0.5" />
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center text-ajn-text-3 p-10 font-mono text-sm border border-dashed border-white/20 rounded-md">
                  NO CHANNELS FOUND
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
