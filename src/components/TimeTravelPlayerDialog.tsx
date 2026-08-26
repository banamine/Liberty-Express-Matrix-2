import React, { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/src/components/ui/dialog";
import Hls from "hls.js";
import { Activity, Clock } from "lucide-react";
import { BACKEND_URL } from "../config";

interface TimeTravelPlayerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string | null;
  title: string | null;
  timestamp: string | null;
}

export function TimeTravelPlayerDialog({ open, onOpenChange, url, title, timestamp }: TimeTravelPlayerDialogProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [error, setError] = useState<string | null>(null);

  let processedUrl = url;
  if (processedUrl && processedUrl.startsWith('/')) {
    processedUrl = BACKEND_URL + processedUrl;
  }

  useEffect(() => {
    if (!open || !processedUrl || !videoRef.current) {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      return;
    }

    const video = videoRef.current;
    setError(null);

    if (processedUrl.includes('.m3u8')) {
      if (Hls.isSupported()) {
        const hls = new Hls({
          maxBufferLength: 30,
          enableWorker: false
        });
        hlsRef.current = hls;

        hls.loadSource(processedUrl);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          const playPromise = video.play();
          if (playPromise !== undefined) {
            playPromise.catch(e => {
              if (e.name !== 'AbortError') console.error("Autoplay prevented:", e.message);
            });
          }
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                setError("Network error encountered while loading stream.");
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                setError("Media error encountered. Attempting to recover...");
                hls.recoverMediaError();
                break;
              default:
                setError("Fatal playback error.");
                hls.destroy();
                break;
            }
          }
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Safari fallback
        video.src = processedUrl;
        video.addEventListener('loadedmetadata', () => {
          const playPromise = video.play();
          if (playPromise !== undefined) {
            playPromise.catch(e => {
              if (e.name !== 'AbortError') console.error("Autoplay prevented:", e.message);
            });
          }
        });
      } else {
        setError("HLS playback is not supported in this browser.");
      }
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [open, url]);

  const formattedTime = timestamp ? new Date(timestamp).toLocaleString(undefined, { 
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', 
    hour: '2-digit', minute: '2-digit' 
  }) : '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] max-w-[1200px] max-h-[85vh] flex flex-col bg-zinc-950 border-zinc-800 p-0 overflow-hidden shadow-2xl shadow-black">
        <DialogHeader className="p-4 border-b border-zinc-900 bg-zinc-900/50 flex flex-row items-center justify-between shrink-0">
          <div>
            <DialogTitle className="text-zinc-100 flex items-center gap-2 text-lg">
              <Activity className="w-5 h-5 text-emerald-500" />
              {title || "Time-Travel Playback"}
            </DialogTitle>
            {timestamp && (
              <p className="text-zinc-500 text-xs flex items-center gap-1 mt-1">
                <Clock className="w-3 h-3" /> Historical Broadcast: {formattedTime}
              </p>
            )}
          </div>
          <div className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded text-xs font-bold tracking-widest uppercase flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Archive Mode
          </div>
        </DialogHeader>

        <div className="relative flex-1 min-h-0 bg-black flex items-center justify-center">
          {error && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/80 text-center p-6 text-zinc-300">
              <Activity className="w-12 h-12 text-red-500 mb-4 opacity-50" />
              <p className="font-semibold text-lg">{error}</p>
              <p className="text-sm text-zinc-500 mt-2 break-all">{url}</p>
            </div>
          )}
          
          <video
            key={processedUrl || "empty"}
            ref={videoRef}
            className="w-full h-auto max-h-[calc(85vh-140px)] object-contain bg-black"
            controls
            autoPlay
            playsInline
            onError={(e) => {
              console.error("[VIDEO ENGINE ERROR] Stream failed to load");
              setError("Video stream failed to load. The source may be unavailable or invalid.");
            }}
          >
            {processedUrl && !processedUrl.includes('.m3u8') && <source src={processedUrl} type="video/mp4" />}
          </video>
        </div>
        
        <div className="p-4 bg-zinc-900/50 border-t border-zinc-900 flex justify-between items-center shrink-0">
          <p className="text-xs text-zinc-500 font-mono break-all line-clamp-1 flex-1 mr-4">
            Source: {processedUrl}
          </p>
          <button 
            onClick={() => onOpenChange(false)}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded text-sm transition-colors"
          >
            Close Viewer
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
