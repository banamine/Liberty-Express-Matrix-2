import { telemetry } from '../lib/telemetry';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, FastForward, SkipBack, Maximize, Signal, Volume2 } from 'lucide-react';

function getTargetDate(offsetDays: number = 0): string {
  const now = new Date();
  const targetTime = new Date(now.getTime() + offsetDays * 86400 * 1000);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short'
  });
  const parts = formatter.formatToParts(targetTime);
  const partMap: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== 'literal') {
      partMap[p.type] = p.value;
    }
  }
  const year = partMap.year;
  const month = partMap.month;
  const day = partMap.day;
  const weekday = partMap.weekday; // e.g. "Mon"
  return `${year}${month}${day}_${weekday}`;
}

function formatDisplayDate(dateStamp: string): string {
  const regex = /^(\d{4})(\d{2})(\d{2})_/;
  const match = dateStamp.match(regex);
  if (!match) return dateStamp;
  const [_, year, monthNum, day] = match;
  const monthNames = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
  const monthName = monthNames[parseInt(monthNum, 10) - 1];
  return `${year} -${monthName}-${day}`;
}

function formatVideoHeader(filename: string): string {
  const regex = /^(\d{4})(\d{2})(\d{2})_/;
  const match = filename.match(regex);
  if (!match) return filename;
  const [_, year, monthNum, day] = match;
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const monthName = monthNames[parseInt(monthNum, 10) - 1];
  return `Alex Jones Network Infowars - AJ BROADCAST / ${year}-${monthName}-${day}`;
}

interface PlaylistItem {
  show: string;
  hour: number;
  url: string;
  filename: string;
}

export default function Player2() {
  const [playlist, setPlaylist] = useState<PlaylistItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [expandedShows, setExpandedShows] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isFallback, setIsFallback] = useState(false);
  const [activeDateStamp, setActiveDateStamp] = useState(getTargetDate(0));
  const [needsInteraction, setNeedsInteraction] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [fallbackUrlOverride, setFallbackUrlOverride] = useState<string | null>(null);
  const handleInteract = () => {
    setNeedsInteraction(false);
    setIsPlaying(true);
    if (videoRef.current) {
      videoRef.current.muted = false;
      videoRef.current.volume = 1.0;
      videoRef.current.play().catch(e => { if (e.name !== "AbortError") console.error(e); });
    }
  };
  const isMutedRef = useRef(true);

  const setVideoRef = useCallback((el: HTMLVideoElement | null) => {
    if (el) {
      el.defaultMuted = isMutedRef.current;
      el.muted = isMutedRef.current;
    }
    videoRef.current = el;
  }, []);
  
  const videoRef = useRef<HTMLVideoElement | null>(null);
  
  const discoverPlaylist = async (): Promise<{ items: PlaylistItem[], isFallback: boolean, dateStamp: string }> => {
    const baseUrl = 'https://ajn.archives.pub/hourly-m4v/';
    const knownShows = ['Alex', 'WarRoom'];
    
    for (let offset = 0; offset >= -7; offset--) {
      const dateStamp = getTargetDate(offset);
      const newPlaylist: PlaylistItem[] = [];
      let foundAny = false;
      
      const maxHours = 4;
      
      for (const showName of knownShows) {
        for (let hour = 1; hour <= maxHours; hour++) {
          const filename = `${dateStamp}_${showName}-Hr${hour}.m4v`;
          const url = `${baseUrl}${filename}`;
          try {
            const probeUrl = `/api/probe?url=${encodeURIComponent(url)}`;
            const response = await fetch(probeUrl);
            if (response.ok) {
              newPlaylist.push({ show: showName, hour, url, filename });
              foundAny = true;
            } else {
              if (hour === 1) {
                console.warn(`[AJPool] Missing primary broadcast Hour 1 for ${showName} on ${dateStamp} (HTTP ${response.status})`);
              } else {
                console.info(`[AJPool] Broadcast hour ${hour} ended or missing for ${showName} on ${dateStamp} (HTTP ${response.status})`);
              }
              break;
            }
          } catch (error) {
            console.error(`[AJPool] Probe exception for ${filename}:`, error);
            break;
          }
        }
      }

      if (foundAny) {
        if (offset < 0) {
          console.info(`[AJPool] Operating on fallback archive buffer from: ${dateStamp}`);
        } else {
          console.log(`[AJPool] Loaded live primary batch for: ${dateStamp}`);
        }
        return { items: newPlaylist, isFallback: offset < 0, dateStamp };
      } else if (offset === 0) {
        console.warn(`[AJPool Warning]: Primary batch for ${dateStamp} missing. Engaging fallback protocol...`);
      }
    }
    
    return { 
      items: [
        { show: 'Alex', hour: 1, url: 'https://archive.org/download/CSPAN_20120504_180000_Q_and_A/CSPAN_20120504_180000_Q_and_A.mp4', filename: 'fallback_Alex-Hr1.mp4' },
        { show: 'WarRoom', hour: 1, url: 'https://archive.org/download/CSPAN_20120504_180000_Q_and_A/CSPAN_20120504_180000_Q_and_A.mp4', filename: 'fallback_WarRoom-Hr1.mp4' }
      ], 
      isFallback: true, 
      dateStamp: getTargetDate(0) 
    };
  };

  const intervalRef = useRef<any>(null);
  useEffect(() => {
    const loadPlaylist = async () => {
      const result = await discoverPlaylist();
      setPlaylist(result.items);
      setIsFallback(result.isFallback);
      setActiveDateStamp(result.dateStamp);
      setIsLoading(false);
      
      const defaultExpanded: Record<string, boolean> = {};
      result.items.forEach(item => { defaultExpanded[item.show] = true; });
      setExpandedShows(prev => Object.keys(prev).length === 0 ? defaultExpanded : prev);
    };
    
    loadPlaylist();
    intervalRef.current = setInterval(loadPlaylist, 60000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  useEffect(() => {
    if (videoRef.current && playlist.length > 0) {
      const baseItemUrl = playlist[currentIndex].url;
      const newUrl = fallbackUrlOverride || baseItemUrl;
      // Only assign if it actually changed, to prevent the 60s restart loop
      if (videoRef.current.getAttribute('src') !== newUrl) {
        videoRef.current.src = newUrl;
        if (isPlaying) {
          videoRef.current.play().catch(err => {
            console.error('Play failed:', err);
            setIsPlaying(false);
          });
        }
      }
    }
  }, [currentIndex, playlist, fallbackUrlOverride]);

  const togglePlay = () => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play().catch(e => console.error(e));
        setIsPlaying(true);
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    }
  };

  const playNext = () => {
    setFallbackUrlOverride(null);
    telemetry.info('playback', 'Player2 segment/chunk advance', { currentIndex: (currentIndex + 1) % playlist.length });
    if (playlist.length === 0) return;
    setCurrentIndex(prev => (prev + 1) % playlist.length);
  };
  
  const playPrevious = () => {
    setFallbackUrlOverride(null);
    if (playlist.length === 0) return;
    setCurrentIndex(prev => (prev - 1 + playlist.length) % playlist.length);
  };
  
  const jumpToHour = (showName: string, hourNum: number) => {
    setFallbackUrlOverride(null);
    const index = playlist.findIndex(item => item.show === showName && item.hour === hourNum);
    if (index !== -1) {
      setCurrentIndex(index);
      setIsPlaying(true);
    }
  };

  const toggleShow = (showName: string) => {
    setExpandedShows(prev => ({ ...prev, [showName]: !prev[showName] }));
  };

  const groupedByShow = playlist.reduce((acc, item) => {
    if (!acc[item.show]) acc[item.show] = [];
    acc[item.show].push(item);
    return acc;
  }, {} as Record<string, PlaylistItem[]>);

  const currentItem = playlist[currentIndex];
  const currentFilename = currentItem?.filename || 'Waiting for schedule...';

  return (
    <div className="flex h-full w-full" style={{
      '--bg': '#121212',
      '--surface-1': '#1a1a1a',
      '--surface-2': '#222222',
      '--surface-3': '#2a2a2a',
      '--text-1': '#f2f2f2',
      '--text-2': '#b8b8b8',
      '--text-3': '#8a8a8a',
      '--border': 'rgba(255,255,255,0.08)',
      '--accent': '#ff6a33',
      '--live': '#33d15f',
      '--warn': '#ff4d4d',
    } as any}>
      <style dangerouslySetInnerHTML={{__html: `
        .playlist-sidebar {
          width: 300px;
          background: var(--surface-1);
          color: #fff;
          padding: 1rem;
          overflow-y: auto;
          border-left: 1px solid var(--border);
        }
        .show-header {
          width: 100%;
          text-align: left;
          background: var(--surface-2);
          border: 1px solid var(--border);
          color: #fff;
          padding: 0.75rem;
          cursor: pointer;
          border-radius: 4px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-weight: bold;
          margin-bottom: 0.5rem;
        }
        .show-header:hover { background: var(--surface-3); }
        .hour-button {
          width: 100%;
          text-align: left;
          background: var(--surface-1);
          border: 1px solid var(--border);
          color: var(--text-2);
          padding: 0.5rem 0.75rem;
          cursor: pointer;
          border-radius: 3px;
          font-size: 0.9rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          transition: all 0.2s;
        }
        .hour-button:hover {
          background: var(--surface-2);
          color: #fff;
        }
        .hour-button.active {
          background: var(--accent);
          color: #fff;
          border-color: var(--accent);
          font-weight: bold;
        }
        .playing-dot { animation: pulse 1s infinite; }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}} />
      
      <div className="flex-1 flex flex-col space-y-6 max-w-5xl mx-auto p-4 bg-[var(--bg)]">
        <div className="p-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <h2 className="text-xl font-bold tracking-wide uppercase" style={{ color: 'var(--text-1)' }}>
            {formatVideoHeader(currentFilename)}
          </h2>
        </div>
        
        <div className="flex-1 min-h-[400px] rounded-xl overflow-hidden relative group" style={{ backgroundColor: 'var(--bg)', border: '1px solid var(--border)' }}>
          <video 
            ref={setVideoRef}
            className="absolute inset-0 w-full h-full object-contain bg-black"
            autoPlay
            controls
            onVolumeChange={(e) => {
              isMutedRef.current = e.currentTarget.muted;
              setIsMuted(e.currentTarget.muted);
            }}
            onEnded={playNext}
            onLoadStart={(e) => telemetry.info('playback', 'Player2 load start', { url: e.currentTarget.currentSrc })}
            onWaiting={(e) => telemetry.warn('playback', 'Player2 buffering/waiting', { url: e.currentTarget.currentSrc })}
            onError={(e) => {
              const video = e.currentTarget;
              const currentSrc = video.currentSrc || video.src || playlist[currentIndex]?.url;
              console.error('Video Error:', video.error, currentSrc);
              telemetry.error('playback', 'Player2 video error', { error: video.error?.message, code: video.error?.code, url: currentSrc });
              if (currentSrc && currentSrc.endsWith('.m4v') && !fallbackUrlOverride) {
                const mp4Fallback = currentSrc.replace('.m4v', '.mp4');
                telemetry.log("warn", "network", `Player2 M4V Format Error: Switching to MP4 fallback ${mp4Fallback}`);
                setFallbackUrlOverride(mp4Fallback);
                return;
              }
              if (playlist.length > 0) playNext();
            }}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
          />
          
          {(playlist.length === 0) && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
              <div className="text-center space-y-4">
                <Signal className="h-16 w-16 mx-auto animate-pulse" style={{ color: 'var(--text-3)' }} />
                <h3 className="text-xl font-bold" style={{ color: 'var(--text-2)' }}>
                  {isLoading ? 'DISCOVERING BROADCAST...' : 'STANDBY SIGNAL'}
                </h3>
              </div>
            </div>
          )}
          {needsInteraction && (
            <div 
              className="absolute inset-0 z-50 flex items-center justify-center cursor-pointer"
              style={{ backgroundColor: "rgba(0, 0, 0, 0.6)", backdropFilter: "blur(4px)" }}
              onClick={handleInteract}
            >
              <div className="flex flex-col items-center gap-3 px-8 py-6 bg-black/80 rounded-xl border border-white/20 shadow-2xl hover:bg-black transition-colors">
                <Volume2 className="h-12 w-12 text-white" />
                <span className="font-bold tracking-wider text-white uppercase text-lg">Tap to Enable Audio</span>
              </div>
            </div>
          )}

          {/* Overlay HUD */}
          <div className="absolute top-0 left-0 right-0 p-6 bg-gradient-to-b from-black/80 to-transparent flex justify-between items-start opacity-0 group-hover:opacity-100 transition-opacity z-20 pointer-events-none">
            <div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full" style={{ backgroundColor: 'var(--live)' }} />
                <span className="font-bold text-sm tracking-widest uppercase" style={{ color: 'var(--text-1)' }}>
                  AJ BROADCAST
                </span>
              </div>
              <h1 className="text-3xl font-bold mt-2 uppercase" style={{ color: 'var(--text-1)' }}>
                {currentItem ? `${currentItem.show.replace('-', ' ')} - Hour ${currentItem.hour}` : formatVideoHeader(currentFilename)}
              </h1>
            </div>
            <div className="text-right">
              <div className="text-2xl font-mono" style={{ color: 'var(--text-2)' }}>
                {new Date().toLocaleTimeString('en-US', { hour12: false })}
              </div>
              <div className="text-sm" style={{ color: 'var(--text-3)' }}>LOCAL SYSTEM TIME</div>
            </div>
          </div>

          <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/90 to-transparent opacity-0 group-hover:opacity-100 transition-opacity z-20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button 
                  onClick={playPrevious} 
                  className="h-10 w-10 rounded-full flex items-center justify-center transition-colors"
                  style={{ backgroundColor: 'var(--surface-3)', color: 'var(--text-1)' }}
                >
                  <SkipBack className="h-5 w-5" />
                </button>
                
                <button 
                  onClick={togglePlay}
                  className="h-12 w-12 rounded-full flex items-center justify-center transition-colors hover:scale-105"
                  style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
                >
                  {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6 ml-1" />}
                </button>
                
                <button 
                  onClick={playNext} 
                  className="h-10 w-10 rounded-full flex items-center justify-center transition-colors"
                  style={{ backgroundColor: 'var(--surface-3)', color: 'var(--text-1)' }}
                >
                  <FastForward className="h-5 w-5" />
                </button>
                <div className="font-mono text-sm" style={{ color: 'var(--text-1)' }}>
                  {isPlaying ? 'PLAYING' : 'PAUSED'}
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <button 
                  className="transition-colors" 
                  style={{ color: 'var(--text-2)' }} 
                  onClick={() => {
                    if (videoRef.current && videoRef.current.requestFullscreen) {
                      videoRef.current.requestFullscreen();
                    }
                  }}
                >
                  <Maximize className="h-6 w-6" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="playlist-sidebar flex-shrink-0">
        <div className="flex justify-between items-start mb-1">
          <h3 className="text-lg font-bold" style={{ color: 'var(--text-1)' }}>
            {isFallback ? 'Archive Buffer' : "Today's Broadcast"}
          </h3>
          {isFallback && (
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded bg-yellow-500/20 text-yellow-500 border border-yellow-500/30">
              Fallback</span>
          )}
        </div>
        <p className="text-sm mb-4 font-mono font-bold tracking-widest drop-shadow-md" style={{ color: isFallback ? 'var(--text-3)' : '#facc15' }}>
          {formatDisplayDate(activeDateStamp)}
        </p>
        
        {Object.entries(groupedByShow).map(([showName, hours]) => (
          <div key={showName} className="mb-4">
            <button 
              className="show-header"
              onClick={() => toggleShow(showName)}
            >
              <span>{showName.replace('-', ' ')}</span>
              <span className="text-sm" style={{ color: 'var(--text-3)' }}>({hours.length}h) {expandedShows[showName] ? '▼' : '▶'}</span>
            </button>
            
            {expandedShows[showName] && (
              <div className="flex flex-col gap-1 pl-2">
                {hours.map((item) => {
                  const isCurrentPlaying = playlist.indexOf(item) === currentIndex;
                  return (
                    <button
                      key={`${item.show}-${item.hour}`}
                      className={`hour-button ${isCurrentPlaying ? 'active' : ''}`}
                      onClick={() => jumpToHour(item.show, item.hour)}
                    >
                      {isCurrentPlaying && <span className="playing-dot">●</span>}
                      Hour {item.hour}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
