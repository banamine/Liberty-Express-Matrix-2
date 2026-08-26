import { telemetry } from '../lib/telemetry';
import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, FastForward, Maximize, Signal, ListVideo, Volume2, VolumeX } from 'lucide-react';
import Hls from 'hls.js';
import { BACKEND_URL } from '../config';

export default function Player1() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [status, setStatus] = useState<'IDLE' | 'LOADING' | 'PLAYING' | 'ERROR'>('IDLE');
  const [programQueue, setProgramQueue] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [lastFetchMs, setLastFetchMs] = useState(Date.now());
  const [bumperIndex, setBumperIndex] = useState<Record<string, any[]>>({});
  const [activeBumper, setActiveBumper] = useState<any>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);

  const [retryCount, setRetryCount] = useState(0);
  const [fallbackUrlOverride, setFallbackUrlOverride] = useState<string | null>(null);
  const [needsInteraction, setNeedsInteraction] = useState(true);


  const resolveNextProgram = (queue: any[], startIndex: number, nowMs: number) => {
    const nowSec = nowMs / 1000;
    for (let i = 0; i < queue.length; i++) {
      const candidateIndex = (startIndex + i) % queue.length;
      const candidate = queue[candidateIndex];
      const startSec = candidate.creationTimeSec || 0;
      const duration = candidate.durationSec || candidate.duration || 3600;
      
      // If the candidate program hasn't ended yet, or if it doesn't have a schedule time
      if (startSec === 0 || startSec + duration > nowSec) {
        return candidateIndex;
      }
    }
    return startIndex % queue.length;
  };

  useEffect(() => {
    fetch('/api/bumpers').then(res => res.json()).then(data => setBumperIndex(data)).catch(console.error);
  }, []);

  // Fetch episodes for linear programming from specific player route
  useEffect(() => {
    const fetchEpisodes = async () => {
      try {
        const res = await fetch('/api/episodes?player=player1');
        if (res.ok) {
          const data = await res.json();
          if (data && data.length > 0) {
            setProgramQueue(data);
            const now = Date.now();
            setLastFetchMs(now);
            checkGapAndResolve(data, 0, now);
          }
        }
      } catch (err) {
        console.error('Failed to load linear programming:', err);
      }
    };
    fetchEpisodes();
  }, []);

  const currentProgram = programQueue[currentIndex];
  const computedTargetUrl = activeBumper?.videoUrl || currentProgram?.url || currentProgram?.videoUrl || currentProgram?.fallbackUrl;
  let targetUrl = fallbackUrlOverride || computedTargetUrl;
  
  if (targetUrl && targetUrl.startsWith('/')) {
    targetUrl = BACKEND_URL + targetUrl;
  }

  useEffect(() => {
    setFallbackUrlOverride(null);
    setRetryCount(0);
  }, [computedTargetUrl]);
  const currentItem = activeBumper || currentProgram;

  useEffect(() => {
    if (!videoRef.current || !targetUrl) return;

    setStatus('LOADING');
    
    if (hlsRef.current) {
      hlsRef.current.stopLoad();
      hlsRef.current.detachMedia();
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (targetUrl.toLowerCase().includes('.m3u8')) {
      if (Hls.isSupported()) {
        const hls = new Hls({ enableWorker: false });
        hlsRef.current = hls;
        hls.loadSource(targetUrl);
        hls.attachMedia(videoRef.current);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          // Seeking is handled entirely by the native onLoadedMetadata handler in the JSX
          if (videoRef.current) {
             // Let the native handler do the play
          }
        });
        hls.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                hls.recoverMediaError();
                break;
              default:
                setStatus('ERROR');
                hls.destroy();
                handleNext(); // skip on fatal
                break;
            }
          }
        });
      } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
        videoRef.current.src = targetUrl;
        // The onLoadedMetadata handler in the JSX will handle this
      }
    } else {
      videoRef.current.src = targetUrl;
      videoRef.current.load();
      // The onLoadedMetadata handler in the JSX will handle this
    }
    
    return () => {
      if (hlsRef.current) {
        hlsRef.current.stopLoad();
        hlsRef.current.detachMedia();
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [targetUrl, currentItem]);

  const [isMuted, setIsMuted] = useState(true);
  const isMutedRef = useRef(true);

  const handleVideoError = () => {
    const isFormatError = videoRef.current?.error?.code === 4;
    if (targetUrl && (targetUrl.includes('ajn.archives.pub') || isFormatError) && !fallbackUrlOverride) {
      const reliableFallback = 'https://archive.org/download/CSPAN_20120504_180000_Q_and_A/CSPAN_20120504_180000_Q_and_A.mp4';
      telemetry.log("warn", "network", `Player1 Stream Error on ${targetUrl}: Switching to Archive.org CSPAN MP4 fallback`);
      setFallbackUrlOverride(reliableFallback);
      setRetryCount(0);
      return;
    }
    if (retryCount >= 1 || isFormatError) {
      if (targetUrl && targetUrl.endsWith('.m4v')) {
        const fallbackUrl = targetUrl.replace('.m4v', '.mp4');
        telemetry.log("warn", "network", `Fallback Protocol Initiated: Switching to ${fallbackUrl}`);
        setFallbackUrlOverride(fallbackUrl);
        setRetryCount(0);
      } else {
        telemetry.log("error", "network", `Terminal Playback Failure for ${targetUrl}, skipping to next program`);
        handleNext();
      }
    } else {
      setRetryCount(prev => prev + 1);
      telemetry.log("warn", "network", `Playback failed. Retry attempt ${retryCount + 1}/1`);
    }
  };

  const setVideoRef = React.useCallback((el: HTMLVideoElement | null) => {
    if (el) {
      el.defaultMuted = isMutedRef.current;
      el.muted = isMutedRef.current;
    }
    videoRef.current = el;
  }, []);

  const handleInteract = () => {
    setNeedsInteraction(false);
    setIsPlaying(true);
    setStatus('PLAYING');
    if (videoRef.current) {
      videoRef.current.muted = false;
      videoRef.current.volume = 1.0;
      videoRef.current.play().catch(e => {
        if (e.name !== 'AbortError') console.error(e);
      });
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !videoRef.current.muted;
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play().catch(e => e.name !== 'AbortError' && console.error(e));
    }
    setIsPlaying(!isPlaying);
  };

  const checkGapAndResolve = (queue: any[], nextIdx: number, nowMs: number) => {
    const candidateIndex = resolveNextProgram(queue, nextIdx, nowMs);
    const candidate = queue[candidateIndex];
    const startSec = candidate?.creationTimeSec || 0;
    const nowSec = nowMs / 1000;

    if (startSec > nowSec + 10) { 
      const gapSec = startSec - nowSec;
      
      const date = new Date(nowMs);
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      const todayKey = `${mm}-${dd}`;
      const yesterdayKey = `${mm}-${String(date.getDate() - 1).padStart(2, '0')}`;
      const tomorrowKey = `${mm}-${String(date.getDate() + 1).padStart(2, '0')}`;
      
      let pool = bumperIndex[todayKey] || [];
      if (pool.length === 0) pool = bumperIndex[yesterdayKey] || [];
      if (pool.length === 0) pool = bumperIndex[tomorrowKey] || [];
      if (pool.length === 0) {
        const monthKeys = Object.keys(bumperIndex).filter(k => k.startsWith(`${mm}-`));
        if (monthKeys.length > 0) {
          const randomKey = monthKeys[Math.floor(Math.random() * monthKeys.length)];
          pool = bumperIndex[randomKey];
        }
      }

      if (pool && pool.length > 0) {
        const selectedBumper = pool[Math.floor(Math.random() * pool.length)];
        setActiveBumper(selectedBumper);
        return; 
      }
    }
    
    setActiveBumper(null);
    setCurrentIndex(candidateIndex);
  };

  useEffect(() => {
    if (!videoRef.current || !activeBumper) return;
    const handleTimeUpdate = () => {
      const vid = videoRef.current;
      if (!vid) return;
      const timeLeft = vid.duration - vid.currentTime;
      if (timeLeft <= 8 && timeLeft > 0) {
        vid.volume = Math.max(0, timeLeft / 8);
      } else {
        vid.volume = 1;
      }
    };
    videoRef.current.addEventListener('timeupdate', handleTimeUpdate);
    return () => {
      if (videoRef.current) {
        videoRef.current.removeEventListener('timeupdate', handleTimeUpdate);
        videoRef.current.volume = 1;
      }
    };
  }, [activeBumper]);

  const handleNext = async () => {
    if (programQueue.length === 0) return;

    const now = Date.now();
    const isNewDay = new Date(now).getDate() !== new Date(lastFetchMs).getDate();
    const is24hUptime = (now - lastFetchMs) > 24 * 60 * 60 * 1000;
    
    // 24-Hour / Midnight Rebalance Trigger
    if (isNewDay || is24hUptime) {
      try {
        // Explicitly clear the old JSON payload array from memory before fetching and parsing the next 24-hour cycle
        setProgramQueue([]);
        const res = await fetch('/api/episodes?player=player1');
        if (res.ok) {
          const data = await res.json();
          if (data && data.length > 0) {
            setProgramQueue(data);
            setLastFetchMs(now);
            checkGapAndResolve(data, 0, now);
            return;
          }
        }
      } catch (err) {
        console.error('Failed to reload schedule:', err);
      }
    }

    // Buffer-Bloat Protection: Handoff Math
    checkGapAndResolve(programQueue, currentIndex + 1, now);
  };

  const showTitle = activeBumper ? (`BUMPER: ${activeBumper.title}`) : (currentProgram?.title || currentProgram?.filename || 'Waiting for schedule...');

  return (
    <div className="space-y-6 h-full flex flex-col max-w-6xl mx-auto" style={{
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
      <div className="p-4 border-b flex justify-between items-center" style={{ borderColor: 'var(--border)' }}>
        <h2 className="text-xl font-bold tracking-wide uppercase" style={{ color: 'var(--text-1)' }}>
          {showTitle}
        </h2>
        <div className="flex items-center gap-2 px-3 py-1 border rounded-full text-xs font-semibold" style={{ borderColor: 'var(--border)', color: 'var(--text-2)' }}>
          <ListVideo className="w-4 h-4" />
          LINEAR VOD
        </div>
      </div>

      <div className="flex-1 min-h-[400px] rounded-xl overflow-hidden relative group" style={{ backgroundColor: 'var(--bg)', border: '1px solid var(--border)' }}>
        {/* TV Player Shell */}
        <video 
          ref={setVideoRef}
          className="absolute inset-0 w-full h-full object-contain bg-black"
          controls
          playsInline
          autoPlay
          onVolumeChange={(e) => {
            isMutedRef.current = e.currentTarget.muted;
            setIsMuted(e.currentTarget.muted);
          }}
          onLoadedMetadata={() => {
            if (!videoRef.current || !currentItem) return;
            const scheduledStart = currentItem.creationTimeSec || 0;
            if (scheduledStart > 0) {
              const nowMs = Date.now();
              const scheduledStartMs = scheduledStart * 1000;
              const elapsedSeconds = Math.max(0, (nowMs - scheduledStartMs) / 1000);
              if (elapsedSeconds > 0 && elapsedSeconds < (currentItem.durationSec || currentItem.duration || Infinity)) {
                videoRef.current.currentTime = elapsedSeconds;
              }
            }
            videoRef.current.play().catch((err) => {
              if (err.name === "AbortError") return;
              console.error("Autoplay prevented:", err);
              setStatus('IDLE');
            });
          }}
          onLoadStart={(e) => telemetry.info('playback', 'Player1 load start', { url: e.currentTarget.currentSrc })}
          onWaiting={(e) => telemetry.warn('playback', 'Player1 buffering/waiting', { url: e.currentTarget.currentSrc })}
          onPlaying={() => {
            setIsPlaying(true);
            setStatus('PLAYING');
          }}
          onPlay={() => {
            setIsPlaying(true);
          }}
          onPause={() => setIsPlaying(false)}
          onError={(e) => {
            const video = e.currentTarget;
            console.error("Video Error:", video.error);
            telemetry.error('playback', 'Player1 video error', { error: video.error?.message, code: video.error?.code, url: video.currentSrc });
            setStatus('ERROR');
            handleVideoError();
          }}
          onEnded={handleNext}
        />
        
        { (status === 'IDLE' || status === 'LOADING') && !needsInteraction && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
            <div className="text-center space-y-4">
              <Signal className="h-16 w-16 mx-auto animate-pulse" style={{ color: 'var(--text-3)' }} />
              <h3 className="text-xl font-bold" style={{ color: 'var(--text-2)' }}>
                {status === 'LOADING' ? 'HYDRATING STREAM' : 'STANDBY SIGNAL'}
              </h3>
              <p className="text-sm font-mono" style={{ color: 'var(--text-3)' }}>
                {status === 'IDLE' ? 'WAITING FOR MEDIA STREAM' : 'WAITING FOR MEDIA STREAM'}
              </p>
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
              <div className={`h-3 w-3 rounded-full`} style={{ backgroundColor: 'var(--accent)' }} />
              <span className="font-bold text-sm tracking-widest uppercase" style={{ color: 'var(--text-1)' }}>
                24H LINEAR BROADCAST
              </span>
            </div>
            <h1 className="text-3xl font-bold mt-2 uppercase" style={{ color: 'var(--text-1)' }}>{showTitle}</h1>
          </div>
        </div>

        {/* Controls */}
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/90 to-transparent opacity-0 group-hover:opacity-100 transition-opacity z-20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button 
                onClick={togglePlay}
                className="h-12 w-12 rounded-full flex items-center justify-center transition-colors hover:scale-105"
                style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
              >
                {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6 ml-1" />}
              </button>
              <div className="font-mono text-sm" style={{ color: 'var(--text-1)' }}>
                {status === 'PLAYING' ? 'PLAYING' : '00:00:00 / --:--:--'}
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <button onClick={handleNext} className="transition-colors hover:text-white" style={{ color: 'var(--text-2)' }}>
                <FastForward className="h-6 w-6" />
              </button>
              <button 
                onClick={toggleMute}
                className="transition-colors hover:text-white" 
                style={{ color: 'var(--text-2)' }} 
              >
                {isMuted ? <VolumeX className="h-6 w-6" /> : <Volume2 className="h-6 w-6" />}
              </button>
              <button 
                className="transition-colors hover:text-white" 
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

      <div className="rounded-xl p-6 shadow-sm" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: '12px' }}>
         <h3 className="font-semibold mb-4 text-lg" style={{ color: 'var(--text-1)' }}>Up Next</h3>
         <div className="space-y-2 overflow-y-auto max-h-[300px]">
           {programQueue.slice(currentIndex + 1, currentIndex + 10).map((prog, idx) => (
             <div key={idx} className="flex items-center justify-between p-3 rounded-md" style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)' }}>
               <div className="flex items-center gap-3">
                 <div className="font-mono text-sm" style={{ color: 'var(--text-3)' }}>{idx + 1}</div>
                 <div className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>{prog.title || prog.filename}</div>
               </div>
               <button 
                 onClick={() => setCurrentIndex((currentIndex + idx + 1) % programQueue.length)}
                 className="text-xs px-3 py-1 rounded transition-colors" 
                 style={{ backgroundColor: 'var(--surface-3)', color: 'var(--text-1)' }}
                 onMouseOver={e => e.currentTarget.style.backgroundColor = 'var(--accent)'}
                 onMouseOut={e => e.currentTarget.style.backgroundColor = 'var(--surface-3)'}
               >
                 Play
               </button>
             </div>
           ))}
           {programQueue.length === 0 && (
             <div className="text-sm font-mono" style={{ color: 'var(--text-3)' }}>No episodes in queue.</div>
           )}
         </div>
      </div>
    </div>
  );
}
