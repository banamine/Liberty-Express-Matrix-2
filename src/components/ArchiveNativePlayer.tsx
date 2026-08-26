import React, { useState, useRef, useEffect } from 'react';
import { Volume2 } from 'lucide-react';
import { telemetry } from '../lib/telemetry';
import { BACKEND_URL } from '../config';

export function ArchiveNativePlayer({ 
  url, 
  title, 
  startTime, 
  endTime 
}: { 
  url: string, 
  title?: string,
  startTime?: number,
  endTime?: number
}) {
  const [needsInteraction, setNeedsInteraction] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const isMutedRef = useRef(true);

  const setVideoRef = (el: HTMLVideoElement | null) => {
    if (el) {
      el.defaultMuted = isMutedRef.current;
      el.muted = isMutedRef.current;
    }
    videoRef.current = el;
  };
  
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Treat URL as an immutable string scalar
  let fullUrl = url;
  if (fullUrl && fullUrl.startsWith('/')) {
    fullUrl = BACKEND_URL + fullUrl;
  }

  // Force a clean DOM remount when the URL changes to prevent AbortErrors
  // and clear any stale media state in the browser engine.
  const playerKey = fullUrl || "empty-player";

  useEffect(() => {
    if (fullUrl) {
      telemetry.info('playback', 'Player initialized', { url: fullUrl, title, startTime, endTime });
    }
  }, [fullUrl, title, startTime, endTime]);

  const handleLoadedMetadata = () => {
    if (videoRef.current && startTime) {
      videoRef.current.currentTime = startTime;
    }
  };

  const handleInteract = () => {
    setNeedsInteraction(false);
    setIsPlaying(true);
    if (videoRef.current) {
      videoRef.current.muted = false;
      videoRef.current.volume = 1.0;
      videoRef.current.play().catch(e => {
        if (e.name !== "AbortError") {
          console.error("Playback blocked", e.message);
          telemetry.error('playback', 'Playback blocked', { error: e.message });
        }
      });
      telemetry.info('playback', 'User interaction unmuted video');
    }
  };

  // Ensure all timeupdate and ended event listeners are properly cleaned up in useEffect return functions
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      // Optional: Add time tracking logic here
    };

    const handleEnded = () => {
      setIsPlaying(false);
      telemetry.info('playback', 'Playback ended naturally', { url: fullUrl });
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('ended', handleEnded);
    };
  }, [playerKey]);

  return (
    <div className="relative w-full max-w-[1200px] bg-black border border-cyan-500 rounded flex flex-col">
      {/* 
        Native HTML Video Element
        - controls: Enables native browser controls
        - playsInline: Prevents fullscreen takeover on iOS
        - preload="metadata": Fetches duration without downloading the whole file
      */}
      <video
        key={playerKey}
        ref={setVideoRef}
        className="w-full h-auto max-h-[85vh] object-contain"
        controls={!needsInteraction}
        playsInline
        preload="auto"
        onVolumeChange={(e) => {
          isMutedRef.current = e.currentTarget.muted;
          setIsMuted(e.currentTarget.muted);
        }}
        autoPlay // attempt muted autoplay
        onLoadedMetadata={handleLoadedMetadata}
        onLoadStart={(e) => telemetry.info('playback', 'ArchiveNativePlayer load start', { url: e.currentTarget.currentSrc })}
        onWaiting={(e) => telemetry.warn('playback', 'ArchiveNativePlayer buffering/waiting', { url: e.currentTarget.currentSrc })}
        onPlay={() => {
          setIsPlaying(true);
          telemetry.info('playback', 'Video playing');
        }}
        onPause={() => {
          setIsPlaying(false);
          telemetry.info('playback', 'Video paused');
        }}
        onError={() => {
          console.error("[ARCHIVE ENGINE ERROR] Stream failed");
          telemetry.error('playback', 'Stream failed', { url: fullUrl });
        }}
      >
        <source src={fullUrl} type="video/mp4" />
        Your browser does not support native video playback.
      </video>

      {/* Interaction Overlay: Forces user to click/touch to enable audio and standard controls */}
      {needsInteraction && (
        <div 
          className="absolute inset-0 z-50 flex items-center justify-center cursor-pointer"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)' }}
          onClick={handleInteract}
        >
          <div className="flex flex-col items-center gap-3 px-8 py-6 bg-black/80 rounded-xl border border-white/20 shadow-2xl hover:bg-black transition-colors">
            <Volume2 className="h-12 w-12 text-white" />
            <span className="font-bold tracking-wider text-white uppercase text-lg">Tap to Enable Audio</span>
          </div>
        </div>
      )}
    </div>
  );
}
