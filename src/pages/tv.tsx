import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, Maximize, Signal, Volume2, VolumeX } from 'lucide-react';
import Hls from 'hls.js';
import { telemetry } from '../lib/telemetry';
import { BACKEND_URL } from '../config';

export default function TVPlayer() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [status, setStatus] = useState<'IDLE' | 'LOADING' | 'PLAYING'>('IDLE');
  
  // Channels
  const [activeChannel, setActiveChannel] = useState<1 | 2>(1);
  
  // Channel 1 State (Linear)
  const [linearQueue, setLinearQueue] = useState<any[]>([]);
  const [linearIndex, setLinearIndex] = useState(0);
  
  // Channel 2 State (Live)
  const [liveUrl, setLiveUrl] = useState<string | null>(null);
  const [liveTitle, setLiveTitle] = useState<string>('Waiting for schedule...');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  // Load Channel 1 (Linear)
  useEffect(() => {
    const fetchEpisodes = async () => {
      try {
        const res = await fetch('/api/aj-pool/status');
        if (res.ok) {
          const data = await res.json();
          if (data.files && data.files.length > 0) {
            setLinearQueue(data.files);
            setLinearIndex(0);
            telemetry.info('network', 'Loaded linear programming queue', { count: data.files.length });
          }
        }
      } catch (err: any) {
        console.error('Failed to load linear programming:', err);
        telemetry.error('network', 'Failed to load linear programming', { error: err.message });
      }
    };
    fetchEpisodes();
  }, []);

  // Load Channel 2 (Live)
  useEffect(() => {
    const evtSource = new EventSource(BACKEND_URL + '/api/aj-pool/stream');
    
    evtSource.addEventListener('STATUS', (e: any) => {
      try {
        const data = JSON.parse(e.data);
        if (data.payload?.currentFile) {
          setLiveTitle(data.payload.currentFile.title || data.payload.currentFile.filename);
          setLiveUrl(data.payload.currentFile.url || data.payload.currentFile.videoUrl);
        }
      } catch (err) {
        console.error('Failed to parse STATUS event:', err);
      }
    });

    evtSource.addEventListener('show_start', (e: any) => {
      try {
        const data = JSON.parse(e.data);
        setLiveTitle(data.title || data.filename || 'AJ BROADCAST');
        setLiveUrl(data.url || data.videoUrl);
        telemetry.info('playback', 'Live show started', { title: data.title || data.filename });
      } catch (err) {
        console.error('Failed to parse show_start event:', err);
      }
    });

    return () => {
      evtSource.close();
    };
  }, []);

  // Determine current source based on active channel
  const linearProgram = linearQueue[linearIndex];
  let linearUrl = linearProgram?.url || linearProgram?.videoUrl || linearProgram?.fallbackUrl;
  
  if (linearUrl && linearUrl.startsWith('/')) {
    linearUrl = BACKEND_URL + linearUrl;
  }
  
  let currentLiveUrl = liveUrl;
  if (currentLiveUrl && currentLiveUrl.startsWith('/')) {
    currentLiveUrl = BACKEND_URL + currentLiveUrl;
  }

  const currentUrl = activeChannel === 1 ? linearUrl : currentLiveUrl;
  const currentTitle = activeChannel === 1 
    ? (linearProgram?.title || linearProgram?.filename || 'Waiting for schedule...')
    : liveTitle;

  useEffect(() => {
    if (!videoRef.current || !currentUrl) return;

    setStatus('LOADING');
    telemetry.info('playback', 'Switching stream', { channel: activeChannel, url: currentUrl, title: currentTitle });
    
    if (hlsRef.current) {
      hlsRef.current.stopLoad();
      hlsRef.current.detachMedia();
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (currentUrl.toLowerCase().includes('.m3u8')) {
      if (Hls.isSupported()) {
        const hls = new Hls({ enableWorker: false });
        hlsRef.current = hls;
        hls.loadSource(currentUrl);
        hls.attachMedia(videoRef.current);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          videoRef.current?.play().catch(e => {
            if (e.name !== "AbortError") {
              console.error(e);
              telemetry.error('playback', 'HLS Autoplay blocked', { error: e.message });
            }
          });
        });
        hls.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
            telemetry.error('playback', 'Fatal HLS error', { type: data.type, details: data.details });
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                hls.recoverMediaError();
                break;
              default:
                hls.destroy();
                if (activeChannel === 1 && linearQueue.length > 0) {
                  setLinearIndex((prev) => (prev + 1) % linearQueue.length);
                }
                break;
            }
          }
        });
      } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
        videoRef.current.src = currentUrl;
        videoRef.current.addEventListener('loadedmetadata', () => {
          videoRef.current?.play().catch(e => {
            if (e.name !== "AbortError") {
              console.error(e);
              telemetry.error('playback', 'Native HLS Autoplay blocked', { error: e.message });
            }
          });
        });
      }
    } else {
      videoRef.current.src = currentUrl;
      videoRef.current.load();
      videoRef.current.play().catch(e => {
        if (e.name !== "AbortError") {
          console.error(e);
          telemetry.error('playback', 'MP4 Autoplay blocked', { error: e.message });
        }
      });
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.stopLoad();
        hlsRef.current.detachMedia();
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [currentUrl, activeChannel]);

  const [needsInteraction, setNeedsInteraction] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const isMutedRef = useRef(true);

  const setVideoRef = useCallback((el: HTMLVideoElement | null) => {
    if (el) {
      el.defaultMuted = isMutedRef.current;
      el.muted = isMutedRef.current;
    }
    videoRef.current = el;
  }, []);

  const handleInteract = () => {
    setNeedsInteraction(false);
    setIsPlaying(true);
    if (videoRef.current) {
      videoRef.current.muted = false;
      videoRef.current.volume = 1.0;
      videoRef.current.play().catch(e => { 
        if (e.name !== "AbortError") {
          console.error("Playback error on interact:", e);
        }
      });
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !videoRef.current.muted;
    telemetry.info('ui', `Video ${videoRef.current.muted ? 'muted' : 'unmuted'}`);
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      telemetry.info('ui', 'User paused video');
    } else {
      videoRef.current.play().catch(e => {
        if (e.name !== "AbortError") console.error(e);
      });
      telemetry.info('ui', 'User played video');
    }
    setIsPlaying(!isPlaying);
  };

  const handleEnded = () => {
    telemetry.info('playback', 'Video ended', { channel: activeChannel, title: currentTitle });
    if (activeChannel === 1 && linearQueue.length > 0) {
      setLinearIndex((prev) => (prev + 1) % linearQueue.length);
    }
  };

  const changeChannel = (ch: 1 | 2) => {
    setActiveChannel(ch);
    setIsGuideOpen(false);
    telemetry.info('ui', 'Changed channel', { from: activeChannel, to: ch });
  };

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
      <div className="flex-1 min-h-[500px] rounded-xl overflow-hidden relative group" style={{ backgroundColor: 'var(--bg)', border: '1px solid var(--border)' }}>
        {/* TV Player Shell */}
        <video 
          ref={setVideoRef}
          className={`absolute inset-0 w-full h-full object-contain bg-black transition-opacity duration-700 ease-in-out ${status === 'PLAYING' ? 'opacity-100' : 'opacity-0'}`}
          controls
          playsInline
          autoPlay
          onVolumeChange={(e) => {
            isMutedRef.current = e.currentTarget.muted;
            setIsMuted(e.currentTarget.muted);
          }}
          onPlaying={() => {
            setIsPlaying(true);
            setStatus('PLAYING');
          }}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={handleEnded}
          onError={(e) => {
            console.error('Video error:', e);
            if (activeChannel === 1 && linearQueue.length > 0) {
               setLinearIndex((prev) => (prev + 1) % linearQueue.length);
            }
          }}
        />
        
        { (status === 'IDLE' || status === 'LOADING') && !needsInteraction && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
            <div className="text-center space-y-4">
              <Signal className="h-16 w-16 mx-auto animate-pulse" style={{ color: 'var(--text-3)' }} />
              <h3 className="text-xl font-bold" style={{ color: 'var(--text-2)' }}>
                {status === 'LOADING' ? 'BUFFERING SIGNAL' : 'NO SIGNAL'}
              </h3>
              <p className="text-sm font-mono" style={{ color: 'var(--text-3)' }}>CH {activeChannel}</p>
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
              <div className={`h-3 w-3 rounded-full`} style={{ backgroundColor: activeChannel === 2 ? 'var(--live)' : 'var(--accent)' }} />
              <span className="font-bold text-sm tracking-widest uppercase" style={{ color: 'var(--text-1)' }}>
                CH {activeChannel} • {activeChannel === 1 ? 'LINEAR VOD' : 'LIVE EDGE'}
              </span>
            </div>
            <h1 className="text-3xl font-bold mt-2 uppercase drop-shadow-md" style={{ color: 'var(--text-1)' }}>{currentTitle}</h1>
          </div>
        </div>

        {/* Guide Overlay (Glassmorphism) */}
        {isGuideOpen && (
          <div className="absolute inset-y-0 right-0 w-80 bg-black/60 backdrop-blur-md border-l z-30 p-4" style={{ borderColor: 'var(--border)' }}>
            <h2 className="text-lg font-bold mb-4 uppercase tracking-widest" style={{ color: 'var(--text-1)' }}>TV Guide</h2>
            <div className="space-y-4">
              <button 
                onClick={() => changeChannel(1)}
                className={`w-full text-left p-4 rounded-lg transition-colors border ${activeChannel === 1 ? 'border-orange-500 bg-orange-500/20' : 'border-transparent hover:bg-white/10'}`}
              >
                <div className="text-xs font-bold mb-1" style={{ color: 'var(--text-2)' }}>CH 1 • LINEAR VOD</div>
                <div className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>
                  {linearProgram?.title || linearProgram?.filename || 'Waiting for schedule...'}
                </div>
              </button>
              
              <button 
                onClick={() => changeChannel(2)}
                className={`w-full text-left p-4 rounded-lg transition-colors border ${activeChannel === 2 ? 'border-green-500 bg-green-500/20' : 'border-transparent hover:bg-white/10'}`}
              >
                <div className="text-xs font-bold mb-1" style={{ color: 'var(--text-2)' }}>CH 2 • LIVE EDGE</div>
                <div className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>
                  {liveTitle}
                </div>
              </button>
            </div>
          </div>
        )}

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
                {status === 'PLAYING' ? (activeChannel === 2 ? 'LIVE' : 'PLAYING') : '00:00:00 / --:--:--'}
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setIsGuideOpen(!isGuideOpen)}
                className="px-4 py-2 rounded-full text-xs font-bold tracking-wider transition-colors hover:bg-white/20 border"
                style={{ color: 'var(--text-1)', borderColor: 'var(--border)', backgroundColor: 'var(--surface-1)' }}
              >
                {isGuideOpen ? 'CLOSE GUIDE' : 'EPG GUIDE'}
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
    </div>
  );
}
