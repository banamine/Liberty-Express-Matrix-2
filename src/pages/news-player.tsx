import { telemetry } from '../lib/telemetry';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MinimalSlideOutGuide } from '@/src/components/MinimalSlideOutGuide';
import { useActiveChannelStore } from '@/src/components/SlideOutGuide';
import { Menu, Tv, Volume2 } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { useStaticRundown, BroadcastSegment } from '@/src/hooks/useStaticRundown';
import { getLiveLoopState } from '@/src/lib/live-loop';

export default function NewsPlayer() {
  const { activeNetwork } = useActiveChannelStore();
  const { rundown, loading: rundownLoading } = useStaticRundown();
  
  const [guideOpen, setGuideOpen] = useState(false);
  const [playerKey, setPlayerKey] = useState(Date.now());
  const [currentSubtitle, setCurrentSubtitle] = useState('');
  
  const [status, setStatus] = useState<'STANDBY' | 'FETCHING_ARRAY' | 'HYDRATING_STREAM' | 'SETTLING' | 'PLAYING' | 'ERROR'>('STANDBY');
  const [ariaMessage, setAriaMessage] = useState('Select a channel from the guide to begin.');
  const [segments, setSegments] = useState<BroadcastSegment[]>([]);
  const [errorCount, setErrorCount] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const errorRetryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const stallStartTimeRef = useRef<number | null>(null);

  const displayNetwork = activeNetwork;
  const [isFading, setIsFading] = useState(false);
  
  const [needsInteraction, setNeedsInteraction] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const isMutedRef = useRef(true);

  const handleInteract = () => {
    setNeedsInteraction(false);
    setIsPlaying(true);
    setStatus("PLAYING");
    isMutedRef.current = false; // <-- keep ref in sync with intent

    if (videoRef.current) {
      videoRef.current.muted = false;
      videoRef.current.volume = 1.0;
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch((e) => {
          if (e.name !== "AbortError") {
            console.error("Playback error on interact:", e);
            telemetry.error('playback', 'Playback error on interact', { error: e.message });
            // Graceful fallback: don't leave state claiming PLAYING if it truly failed
            if (e.name === "NotAllowedError") {
              setIsPlaying(false);
            }
          }
        });
      }
      telemetry.info('playback', 'User interaction unmuted video');
    }
  };

  const setVideoRef = useCallback((el: HTMLVideoElement | null) => {
    if (el) {
      el.defaultMuted = isMutedRef.current;
      el.muted = isMutedRef.current;
    }
    videoRef.current = el;
  }, []);

  useEffect(() => {
    if (!displayNetwork) {
      setStatus('STANDBY');
      setAriaMessage('Select a channel from the guide to begin.');
      setSegments([]);
      return;
    }
    
    if (rundownLoading) {
      setStatus('FETCHING_ARRAY');
      setAriaMessage('Fetching broadcast rundown...');
      return;
    }
    
    setStatus('HYDRATING_STREAM');
    setAriaMessage('Hydrating archive broadcast chunks...');
    
    // Find matching channel.
    const channelRundown = rundown.find(r => r.network === displayNetwork);
    
    if (channelRundown && channelRundown.segments.length > 0) {
      setSegments(channelRundown.segments);
      setStatus('SETTLING');
      setAriaMessage('Stream ready.');
      setPlayerKey(Date.now());
      setIsFading(false);
    } else {
      setStatus('ERROR');
      setAriaMessage('Channel not found in rundown.');
    }
  }, [displayNetwork, rundown, rundownLoading]);

  const { currentSegment, offset } = segments.length > 0 ? getLiveLoopState(segments) : { currentSegment: null, offset: 0 };
  const realId = currentSegment ? currentSegment.identifier : '';
  
  // CRITICAL: Archive.org TV News limits streams to 300 seconds max. We must request a chunk.
  let videoUrl = '';
  if (currentSegment && realId) {
    if (offset < currentSegment.duration) {
      const endOffset = Math.min(Math.floor(offset) + 300, currentSegment.duration);
      videoUrl = `https://archive.org/download/${realId}/${realId}.mp4?t=${Math.floor(offset)}/${endOffset}&ignore=x.mp4`;
    }
  }

  // Reset stall time when we reach a good state or leave SETTLING
  useEffect(() => {
    if (status === 'PLAYING') {
      stallStartTimeRef.current = null;
      setErrorCount(0);
    } else if (status === 'SETTLING') {
      if (stallStartTimeRef.current === null) {
        stallStartTimeRef.current = Date.now();
      }
    } else {
      stallStartTimeRef.current = null;
    }
  }, [status]);

  // Cleanup for errorRetryTimeoutRef to prevent racing remounts
  useEffect(() => {
    return () => {
      if (errorRetryTimeoutRef.current) {
        clearTimeout(errorRetryTimeoutRef.current);
        errorRetryTimeoutRef.current = null;
      }
    };
  }, [playerKey]);

  // Background retry from ERROR state
  useEffect(() => {
    if (status !== 'ERROR') return;
    const retryTimeout = setTimeout(() => {
      if (segments.length > 0) {
        setPlayerKey(Date.now());
        setStatus('SETTLING');
        setErrorCount(0);
      }
    }, 60000); // 60s background retry
    return () => clearTimeout(retryTimeout);
  }, [status, segments.length]);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Network timeout guard
  useEffect(() => {
    if (status !== 'SETTLING') return;
    
    timeoutRef.current = setTimeout(() => {
       if (errorRetryTimeoutRef.current) {
         console.warn("Network timeout guard skipped - short retry already pending.");
         return;
       }
       
       const stallDuration = stallStartTimeRef.current ? (Date.now() - stallStartTimeRef.current) : 0;
       if (stallDuration > 45000) {
         console.error(`Hard ceiling reached: ${Math.round(stallDuration / 1000)}s of continuous stall. Bailing to ERROR state.`);
         setStatus('ERROR');
         setAriaMessage('Stream unavailable. Please try another channel.');
         setIsPlaying(false);
         return;
       }

       console.warn("Network timeout guard triggered - no playing event received in 15 seconds.");
       setPlayerKey(Date.now());
    }, 15000);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [playerKey, status, segments.length]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onEnded = () => {
      // Advance to the next 300s chunk or the next segment in the loop.
      telemetry.info('playback', 'NewsPlayer segment/chunk advance', { currentSegment: currentSegment?.identifier });
      setPlayerKey(Date.now());
    };

    const onTimeUpdate = () => {
      if (currentSegment) {
        setCurrentSubtitle(currentSegment.title || currentSegment.identifier);
      }
    };

    video.addEventListener('ended', onEnded);
    video.addEventListener('timeupdate', onTimeUpdate);

    return () => {
      video.removeEventListener('ended', onEnded);
      video.removeEventListener('timeupdate', onTimeUpdate);
    };
  }, [currentSegment, segments.length, playerKey]);

  return (
    <div className="relative flex flex-col h-full min-h-[calc(100vh-2rem)] bg-black text-white overflow-hidden rounded-md border border-border">
      {/* Top HUD */}
      <div 
        className="absolute top-0 left-0 right-0 px-4 pb-4 flex justify-between items-center z-30 bg-gradient-to-b from-black/80 to-transparent pointer-events-none"
        style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}
      >
        <div className="flex items-center gap-3 pointer-events-auto">
           <Button variant="ghost" size="icon" onClick={() => setGuideOpen(true)} className="text-white hover:bg-white/20 min-w-[44px] min-h-[44px]">
             <Menu className="h-6 w-6" />
           </Button>
           {displayNetwork && (
             <h1 className="text-xl font-bold tracking-widest uppercase">{displayNetwork}</h1>
           )}
        </div>
        {displayNetwork && (
          <div className="flex items-center gap-4 pointer-events-auto">
             <div className="flex items-center gap-2 px-3 py-1 bg-live/20 border border-live/50 rounded-sm">
               <div className="w-2 h-2 rounded-full bg-live animate-pulse" />
               <span className="text-xs font-bold tracking-wider text-live">LIVE</span>
             </div>
          </div>
        )}
      </div>

      {/* Main Player Area — video and ticker are now separate stacked regions, not overlapping */}
      <div className="flex-1 flex flex-col bg-black">
        <div className="flex-1 relative bg-black flex items-center justify-center">
           {/* ARIA Live Region for polite screen reader updates */}
           <div aria-live="polite" className="sr-only">
             {ariaMessage}
           </div>

           {status === 'STANDBY' && (
             <div className="absolute inset-0 flex items-center justify-center bg-black/95 z-10 transition-opacity">
               <div className="text-center space-y-4">
                 <Tv className="w-12 h-12 text-white/20 mx-auto mb-4" />
                 <h3 className="text-lg font-bold tracking-widest text-white/50 uppercase">
                   STANDBY
                 </h3>
                 <p className="text-sm font-mono text-white/30">Select a channel from the guide to begin.</p>
                 <Button variant="outline" className="mt-4 border-white/20 text-white/70 hover:bg-white/10" onClick={() => setGuideOpen(true)}>
                   Open Guide
                 </Button>
               </div>
             </div>
           )}

           {/* Only mount the video element when we are in a settled/playing state to prevent readyState 0 aborts */}
           {(status === 'SETTLING' || status === 'PLAYING') && videoUrl && (
             <video 
               key={playerKey}
               ref={setVideoRef}
               src={videoUrl}
               preload="auto"
               playsInline
               autoPlay
               onVolumeChange={(e) => {
                 isMutedRef.current = e.currentTarget.muted;
                 setIsMuted(e.currentTarget.muted);
               }}
               poster={currentSegment ? currentSegment.thumbBase : ''}
               className={`absolute inset-0 w-full h-full object-contain bg-black transform-gpu transition-opacity duration-500 ${isFading ? 'opacity-0' : 'opacity-100'}`}
               style={{ willChange: 'transform, opacity' }}
               onLoadStart={(e) => telemetry.info('playback', 'NewsPlayer load start', { url: e.currentTarget.currentSrc })}
               onWaiting={(e) => telemetry.warn('playback', 'NewsPlayer buffering/waiting', { url: e.currentTarget.currentSrc })}
               onPlaying={() => {
                 setIsPlaying(true);
                 setStatus('PLAYING');
                 setAriaMessage('Stream playing.');
                 setErrorCount(0);
               }}
               onCanPlay={() => {
                 setStatus(prev => prev === 'PLAYING' ? 'PLAYING' : 'SETTLING');
               }}
               onLoadedMetadata={(e) => {
                 setStatus(prev => prev === 'PLAYING' ? 'PLAYING' : 'SETTLING');
                 
                 const target = e.target as HTMLVideoElement;
                 // Diagnostic check for incoming video/audio tracks in the player
                 if ('audioTracks' in target) {
                   const audioTracks = (target as any).audioTracks;
                   console.log(`[AJ Player Diagnostics] Active audio tracks detected:`, audioTracks?.length || 0);
                   
                   if (audioTracks && audioTracks.length > 0) {
                     for (let i = 0; i < audioTracks.length; i++) {
                       console.log(`Track ${i}: ${audioTracks[i].label} (${audioTracks[i].language}) - Enabled: ${audioTracks[i].enabled}`);
                       // Normalize to ensure only the primary track is playing, 
                       // dropping unmapped secondary surround or foreign commentary channels
                       audioTracks[i].enabled = (i === 0);
                     }
                     console.log(`[AJ Player Diagnostics] Normalized audio to Track 0.`);
                   }
                 } else {
                   console.log('[AJ Player Diagnostics] HTML5 audioTracks API not supported in this browser; relying on native element downmix.');
                 }
               }}
               onError={(e: any) => {
                 const target = e.target as HTMLVideoElement;
                 
                 // Ignore errors from old, unmounted video elements
                 if (target !== videoRef.current) {
                   return;
                 }
                 
                 const err = target?.error;
                 
                 // Ignore aborts (e.g., when React unmounts the video because we changed its key)
                 if (err && err.code === 1) {
                   return;
                 }
                 
                 console.error("Video error or network stall detected:",
                   err ? `Code: ${err.code}, Message: ${err.message}` : "Unknown error",
                   "| Failed URL:", videoUrl,
                   "| offset:", offset.toFixed(2), "of duration:", currentSegment?.duration,
                   "| identifier:", currentSegment?.identifier,
                   "| network:", displayNetwork
                 );
                 
                 if (errorRetryTimeoutRef.current) return;
                 
                 const stallDuration = stallStartTimeRef.current ? (Date.now() - stallStartTimeRef.current) : 0;
                 if (stallDuration > 45000 || errorCount >= 10) {
                   console.error("Hard ceiling reached in onError. Bailing to ERROR state.");
                   setStatus('ERROR');
                   setAriaMessage('Stream unavailable. Please try another channel.');
                   setIsPlaying(false);
                   return;
                 }
                 
                 setErrorCount((prev) => prev + 1);
                 
                 // Allow network handshake/CORS to settle by retrying
                 errorRetryTimeoutRef.current = setTimeout(() => {
                   errorRetryTimeoutRef.current = null;
                   setPlayerKey(Date.now());
                 }, 2000);
               }}
             />
           )}

           {(status === 'FETCHING_ARRAY' || status === 'HYDRATING_STREAM' || status === 'SETTLING') && !needsInteraction && (
             <div className="absolute inset-0 flex items-center justify-center bg-black/95 z-10 transition-opacity">
               <div className="text-center space-y-4">
                 <div className="h-12 w-12 rounded-full border-2 border-primary/30 border-t-primary animate-spin mx-auto" />
                 <h3 className="text-sm font-mono tracking-widest text-primary uppercase" aria-hidden="true">
                   {status === 'FETCHING_ARRAY' ? 'FETCHING RUNDOWN...' :
                     status === 'HYDRATING_STREAM' ? 'HYDRATING CHUNKS...' : 'BUFFERING STREAM...'}
                 </h3>
                 <p className="text-xs font-mono text-white/50" aria-hidden="true">CH {displayNetwork}</p>
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
           {status === 'ERROR' && (
             <div className="absolute inset-0 flex items-center justify-center bg-black/95 z-10 transition-opacity">
               <div className="text-center space-y-4">
                 <div className="h-12 w-12 rounded-full border-2 border-destructive/30 border-t-destructive animate-pulse mx-auto" />
                 <h3 className="text-sm font-mono tracking-widest text-destructive uppercase">
                   STREAM UNAVAILABLE
                 </h3>
                 <p className="text-xs font-mono text-white/50">Please try another channel or wait for the feed to resume.</p>
               </div>
             </div>
           )}
        </div>

        {/* Ticker now lives in its own fixed-height bar below the video, never overlapping it */}
        <div 
          className="shrink-0 bg-black border-t border-white/10 px-4 md:px-8 landscape:hidden md:landscape:block"
          style={{ paddingTop: '0.75rem', paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
        >
          <div className="bg-black/80 backdrop-blur-md border-l-4 border-accent p-2 md:p-3 max-w-5xl mx-auto rounded-sm shadow-xl">
            <p className="text-sm md:text-lg font-medium text-white tracking-wide uppercase drop-shadow-md">
              {currentSubtitle || "Loading ticker stream..."}
            </p>
          </div>
        </div>

        {/* Ticker overlay for small landscape screens to avoid pushing video off-screen */}
        <div className="absolute bottom-4 left-4 right-4 z-20 hidden landscape:block md:landscape:hidden pointer-events-none"
             style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          <div className="bg-black/60 backdrop-blur-md border-l-4 border-accent p-2 rounded-sm shadow-xl pointer-events-auto">
            <p className="text-xs font-medium text-white tracking-wide uppercase drop-shadow-md line-clamp-2">
              {currentSubtitle || "Loading ticker stream..."}
            </p>
          </div>
        </div>
      </div>

      {/* Slide-out EPG Guide */}
      <MinimalSlideOutGuide isOpen={guideOpen} onClose={() => setGuideOpen(false)} />
    </div>
  );
}
