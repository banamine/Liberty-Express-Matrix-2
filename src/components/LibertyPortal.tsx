import React, { useState, useEffect, useRef } from 'react';
import Hls from 'hls.js';
import { Play, Pause, Radio, Tv, AlertTriangle, RefreshCw, Terminal, Volume2, VolumeX, Layers, Globe } from 'lucide-react';

interface Channel {
  id: string;
  name: string;
  type: string;
  source: string;
  status: string;
  streamUrl?: string | null;
  fallbackUrl?: string;
  requiresManualUrl?: boolean;
  note?: string;
  currentProgram?: {
    id?: string;
    identifier?: string;
    title: string;
    duration?: number;
    timestamp?: string;
    thumbBase?: string;
  };
}

export default function LibertyPortal() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [manualUrlInput, setManualUrlInput] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);

  // Live clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch channels.json
  useEffect(() => {
    fetch('/channels.json')
      .then(res => res.json())
      .then(data => {
        if (data && data.channels) {
          setChannels(data.channels);
          if (data.channels.length > 0) {
            setActiveChannel(data.channels[0]);
          }
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load channels.json:', err);
        setLoading(false);
      });
  }, []);

  // switchChannel logic with HLS.js / HTML5 video handling
  const switchChannel = (channel: Channel) => {
    setActiveChannel(channel);
    setIsPlaying(true);
  };

  useEffect(() => {
    if (!activeChannel || !activeChannel.streamUrl || !videoRef.current) return;

    const url = activeChannel.streamUrl;
    const video = videoRef.current;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (url.includes('.m3u8') || url.includes('.m4v') || url.includes('.mp4')) {
      if (url.includes('.m3u8') && Hls.isSupported()) {
        const hls = new Hls();
        hlsRef.current = hls;
        hls.loadSource(url);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play().catch(() => setIsPlaying(false));
          setIsPlaying(true);
        });
      } else {
        video.src = url;
        video.load();
        video.play().catch(() => setIsPlaying(false));
        setIsPlaying(true);
      }
    }
  }, [activeChannel]);

  const handleManualStreamSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualUrlInput.trim() || !activeChannel) return;
    const updated = channels.map(c => {
      if (c.id === activeChannel.id) {
        return {
          ...c,
          streamUrl: manualUrlInput.trim(),
          status: 'LIVE (MANUAL SOURCE)',
          requiresManualUrl: false
        };
      }
      return c;
    });
    setChannels(updated);
    setActiveChannel({
      ...activeChannel,
      streamUrl: manualUrlInput.trim(),
      status: 'LIVE (MANUAL SOURCE)',
      requiresManualUrl: false
    });
    setManualUrlInput('');
  };

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#121212] text-[#f2f2f2]">
        <div className="flex flex-col items-center space-y-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#ff6a33] border-t-transparent" />
          <p className="text-sm font-mono text-[#b8b8b8]">Loading Liberty Express Matrix Portal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#121212] text-[#f2f2f2] flex flex-col font-sans">
      {/* Top Navigation / Broadcast Header */}
      <header className="border-b border-[rgba(255,255,255,0.08)] bg-[#1a1a1a] px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center space-x-3">
          <div className="h-3 w-3 rounded-full bg-[#ff6a33] animate-pulse" />
          <h1 className="text-xl font-bold tracking-wider text-[#f2f2f2]">
            LIBERTY <span className="text-[#ff6a33]">EXPRESS</span> MATRIX 2
          </h1>
          <span className="rounded bg-[#222222] px-2.5 py-0.5 text-xs font-mono text-[#b8b8b8] border border-[rgba(255,255,255,0.08)]">
            v2.0 Broadcast Portal
          </span>
        </div>

        <div className="flex items-center space-x-6">
          <div className="hidden md:flex items-center space-x-2">
            <span className="h-2 w-2 rounded-full bg-[#33d15f]" />
            <span className="text-xs font-mono text-[#8a8a8a]">SYSTEM SYNCED</span>
          </div>
          <div className="text-right font-mono">
            <div className="text-sm font-semibold text-[#ff6a33]">
              {currentTime.toLocaleTimeString('en-US', { hour12: false })}
            </div>
            <div className="text-[11px] text-[#8a8a8a]">
              {currentTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Stage */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-6 p-6 max-w-[1600px] mx-auto w-full">
        
        {/* Main Stage Video Player (Span 3) */}
        <div className="lg:col-span-3 flex flex-col space-y-4">
          <div className="relative aspect-video w-full rounded-xl bg-[#1a1a1a] border border-[rgba(255,255,255,0.08)] overflow-hidden shadow-2xl flex items-center justify-center">
            
            {activeChannel?.requiresManualUrl ? (
              <div className="absolute inset-0 bg-[#121212]/90 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center space-y-4 z-20">
                <div className="rounded-full bg-[#ff4d4d]/10 p-4 border border-[#ff4d4d]/30 text-[#ff4d4d]">
                  <AlertTriangle className="h-8 w-8" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-[#f2f2f2]">{activeChannel.name}</h3>
                  <span className="inline-block px-3 py-1 rounded-full text-xs font-mono bg-[#ff4d4d]/20 text-[#ff4d4d] border border-[#ff4d4d]/30">
                    {activeChannel.status}
                  </span>
                  <p className="text-sm text-[#b8b8b8] max-w-md mx-auto pt-2">
                    {activeChannel.note || "No confirmed live stream URL available right now. Please enter a valid stream or HLS/Rumble URL manually below."}
                  </p>
                </div>

                <form onSubmit={handleManualStreamSubmit} className="flex w-full max-w-md space-x-2 pt-2">
                  <input
                    type="url"
                    placeholder="Enter valid stream URL (https://...)"
                    value={manualUrlInput}
                    onChange={(e) => setManualUrlInput(e.target.value)}
                    className="flex-1 rounded-lg bg-[#222222] border border-[rgba(255,255,255,0.1)] px-4 py-2.5 text-sm text-[#f2f2f2] placeholder-[#8a8a8a] focus:outline-none focus:border-[#ff6a33]"
                  />
                  <button
                    type="submit"
                    className="rounded-lg bg-[#ff6a33] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#ff8a5c] transition-colors"
                  >
                    Connect
                  </button>
                </form>
              </div>
            ) : null}

            {activeChannel?.streamUrl && !activeChannel.requiresManualUrl ? (
              <video
                ref={videoRef}
                controls
                autoPlay
                muted={isMuted}
                playsInline
                className="h-full w-full object-contain bg-black"
              />
            ) : (
              <div className="flex flex-col items-center justify-center space-y-2 text-[#8a8a8a]">
                <Radio className="h-12 w-12 animate-pulse text-[#ff6a33]" />
                <p className="text-sm font-mono">Select a live channel from the rail</p>
              </div>
            )}

            {/* Upper Badge Overlay */}
            <div className="absolute top-4 left-4 z-10 flex items-center space-x-2">
              <span className={`px-3 py-1 rounded-md text-xs font-mono font-bold tracking-wider shadow-md ${
                activeChannel?.status === 'LIVE' 
                  ? 'bg-[#33d15f] text-black' 
                  : 'bg-[#ff4d4d] text-white'
              }`}>
                {activeChannel?.status || 'OFFLINE'}
              </span>
              <span className="px-3 py-1 rounded-md text-xs font-mono bg-black/60 backdrop-blur-md text-[#f2f2f2] border border-[rgba(255,255,255,0.1)]">
                {activeChannel?.source?.toUpperCase()}
              </span>
            </div>
          </div>

          {/* Program Metadata Bar */}
          <div className="rounded-xl bg-[#1a1a1a] border border-[rgba(255,255,255,0.08)] p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="text-xs font-mono text-[#ff6a33] uppercase tracking-wider mb-1">Current Active Broadcast</div>
              <h2 className="text-lg font-bold text-[#f2f2f2]">
                {activeChannel?.currentProgram?.title || activeChannel?.name || 'No Active Broadcast'}
              </h2>
              <p className="text-xs text-[#b8b8b8] mt-1 font-mono">
                {activeChannel?.currentProgram?.id || activeChannel?.currentProgram?.identifier || 'Signal active'}
              </p>
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={() => setIsMuted(!isMuted)}
                className="flex items-center space-x-2 rounded-lg bg-[#222222] border border-[rgba(255,255,255,0.08)] px-4 py-2 text-sm font-medium text-[#f2f2f2] hover:bg-[#2a2a2a] transition-colors"
              >
                {isMuted ? <VolumeX className="h-4 w-4 text-[#ff4d4d]" /> : <Volume2 className="h-4 w-4 text-[#33d15f]" />}
                <span>{isMuted ? 'Unmute' : 'Mute'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Channel Rail (Span 1) */}
        <div className="lg:col-span-1 flex flex-col space-y-4">
          <div className="rounded-xl bg-[#1a1a1a] border border-[rgba(255,255,255,0.08)] p-4 flex flex-col h-full max-h-[720px]">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-[rgba(255,255,255,0.08)]">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-[#b8b8b8] flex items-center space-x-2">
                <Tv className="h-4 w-4 text-[#ff6a33]" />
                <span>Channel Rail</span>
              </h3>
              <span className="text-xs font-mono text-[#8a8a8a]">{channels.length} Channels</span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {channels.map((ch) => {
                const isActive = activeChannel?.id === ch.id;
                return (
                  <div
                    key={ch.id}
                    onClick={() => switchChannel(ch)}
                    className={`group relative rounded-xl p-3.5 cursor-pointer transition-all border ${
                      isActive
                        ? 'bg-[#222222] border-[#ff6a33] shadow-[0_0_24px_rgba(255,106,51,0.15)]'
                        : 'bg-[#1a1a1a] border-[rgba(255,255,255,0.08)] hover:bg-[#222222] hover:border-[rgba(255,255,255,0.15)]'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                        ch.status === 'LIVE' ? 'bg-[#33d15f]/20 text-[#33d15f] border border-[#33d15f]/30' : 'bg-[#ff4d4d]/20 text-[#ff4d4d] border border-[#ff4d4d]/30'
                      }`}>
                        {ch.status}
                      </span>
                      <span className="text-[10px] font-mono text-[#8a8a8a] uppercase">{ch.source}</span>
                    </div>

                    <h4 className="text-sm font-bold text-[#f2f2f2] group-hover:text-[#ff6a33] transition-colors line-clamp-1">
                      {ch.name}
                    </h4>

                    <p className="text-xs text-[#b8b8b8] mt-1 line-clamp-1 font-mono">
                      {ch.currentProgram?.title || ch.note || 'Ready for stream switch'}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      </div>

      {/* Breaking News Ticker */}
      <footer className="mt-auto border-t border-[rgba(255,255,255,0.08)] bg-[#1a1a1a] py-2 px-6 overflow-hidden">
        <div className="flex items-center space-x-4">
          <span className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-[#ff6a33] text-black font-mono font-bold text-xs shrink-0">
            <Radio className="h-3 w-3 animate-pulse" />
            <span>BREAKING MATRIX FEED</span>
          </span>
          <div className="overflow-hidden whitespace-nowrap w-full">
            <div className="inline-block animate-marquee text-xs font-mono text-[#b8b8b8]">
              • Liberty Express Matrix 2 operational live broadcast pipeline active • Real-time HLS feed synchronized with AJN and Archive.org hourly rundowns • Live Player 2 standby pending secure token configuration • All regional streams validated.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
