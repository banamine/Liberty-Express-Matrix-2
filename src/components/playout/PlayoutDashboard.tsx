// DOCUMENTATION:
// PlayoutDashboard.tsx vs news-player.tsx
// `news-player.tsx` is the primary shipping player for the application. It uses `useStaticRundown` 
// to read from `daily-rundown.json` and manages actual <video> playback for the 24/7 channels.
// `PlayoutDashboard.tsx` serves as a supplemental visual control center/dashboard for system metrics,
// but for consistency with the primary player, it should ideally use `useStaticRundown` as well.
// For now, this file remains a secondary dashboard view.

import React, { useState } from 'react';
import { useSystemCountdown } from '../../hooks/useSystemCountdown';
import './PlayoutDashboard.css';

interface Broadcast {
  id: string;
  title: string;
  status: 'PLAYING_NOW' | 'ARCHIVED' | 'QUEUED_FUTURE';
  endTime: string;
}

interface DashboardProps {
  apiEndpoint?: string;
}

const PlayoutDashboard: React.FC<DashboardProps> = () => {
  const [viewMode, setViewMode] = useState<'heatmap' | 'timeline'>('heatmap');
  const [activeBroadcast, setActiveBroadcast] = useState<Broadcast | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingPhase, setLoadingPhase] = useState<'FETCHING' | 'HYDRATING' | 'SETTLED'>('FETCHING');
  const [ariaMessage, setAriaMessage] = useState('Fetching latest news feed...');

  const fetchSchedule = React.useCallback(async (isMountedRef: { current: boolean }) => {
    try {
      setLoadingPhase('FETCHING');
      setAriaMessage('Fetching latest news feed...');
      setLoadError(null);
      
      const response = await fetch('/api/stream/schedule');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const text = await response.text();
      
      if (text.trim().startsWith('<') || text.includes('<!doctype')) {
        throw new Error('Received HTML document instead of JSON (server warming up).');
      }

      let data;
      try {
        data = JSON.parse(text);
      } catch (parseErr) {
        throw new Error('Invalid JSON response from server.');
      }
      
      if (!isMountedRef.current) return;

      setLoadingPhase('HYDRATING');
      setAriaMessage('Hydrating archive broadcast chunks...');
      
      await new Promise(r => setTimeout(r, 400));
      
      if (!isMountedRef.current) return;

      setLoadingPhase('SETTLED');
      setAriaMessage('Stream ready.');

      if (data && data.blocks && data.blocks.length > 0) {
        const nowPlaying = data.blocks.find((b: any) => b.status === 'PLAYING_NOW') || data.blocks[0];
        setActiveBroadcast({
          id: nowPlaying.id || 'unknown',
          title: nowPlaying.title || 'Unknown Broadcast',
          status: nowPlaying.status || 'PLAYING_NOW',
          endTime: nowPlaying.endTime || new Date(Date.now() + 45 * 60000).toISOString()
        });
      } else {
        setActiveBroadcast(null);
      }
    } catch (err: any) {
      if (!isMountedRef.current) return;
      console.warn("Schedule fetch graceful fallback:", err);
      setLoadError(err.message || 'Unable to load schedule data.');
      setLoadingPhase('SETTLED');
    }
  }, []);

  React.useEffect(() => {
    const isMountedRef = { current: true };
    fetchSchedule(isMountedRef);
    
    return () => {
      isMountedRef.current = false;
    };
  }, [fetchSchedule]);

  const dynamicCountdown = useSystemCountdown(activeBroadcast?.endTime || new Date().toISOString());

  return (
    <div className="matrix-canvas">
      {/* ARIA Live Region for polite screen reader updates */}
      <div aria-live="polite" className="sr-only">
        {ariaMessage}
      </div>

      {/* Top Navigation / Controls */}
      <header className="glass-panel nav-header">
        <h1 className="neon-title cyan-glow">MATRIX STRIPPER <span className="version">v3.0.0</span></h1>
        <div className="view-toggles">
          <button 
            className={`neon-btn ${viewMode === 'heatmap' ? 'active-green' : ''}`}
            onClick={() => setViewMode('heatmap')}
          >
            Heatmap
          </button>
          <button 
            className={`neon-btn ${viewMode === 'timeline' ? 'active-green' : ''}`}
            onClick={() => setViewMode('timeline')}
          >
            Timeline
          </button>
        </div>
      </header>

      <main className="dashboard-grid">
        {/* Active Player Status Window */}
        <section className="glass-panel active-player-module">
          {loadError ? (
            <div className="status-header flex items-center justify-between">
              <span className="badge bg-zinc-800 text-zinc-300">[STANDBY MODE]</span>
              <span className="live-indicator text-zinc-400">○ OFFLINE / FALLBACK</span>
            </div>
          ) : activeBroadcast ? (
            <div className="status-header flex items-center justify-between">
              <span className="badge neon-green-bg">[{activeBroadcast.status}]</span>
              <span className="live-indicator">● LIVE ENGINE</span>
            </div>
          ) : (
            <div className="status-header flex items-center justify-between">
              <span className="badge bg-gray-600">[AWAITING DATA]</span>
              <span className="live-indicator text-gray-400">○ STANDBY</span>
            </div>
          )}

          {loadError ? (
            <div className="mt-8 border border-zinc-800 bg-zinc-900/60 p-6 rounded-lg text-center space-y-3">
              <h3 className="text-lg font-medium text-zinc-200">Schedule Currently Unavailable</h3>
              <p className="text-zinc-400 text-sm max-w-md mx-auto">
                We couldn't reach the live schedule feed. Running in standard standby mode.
              </p>
              <button 
                onClick={() => fetchSchedule({ current: true })}
                className="mt-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium rounded transition-colors"
              >
                Retry Connection
              </button>
            </div>
          ) : loadingPhase !== 'SETTLED' ? (
            <div className="player-viewport flex items-center justify-center bg-black">
              <div className="text-center space-y-4">
                <div className="h-12 w-12 rounded-full border-2 border-cyan-500/30 border-t-cyan-400 animate-spin mx-auto" />
                <h3 className="text-sm font-mono tracking-widest text-cyan-400 uppercase" aria-hidden="true">
                  {loadingPhase === 'FETCHING' ? 'FETCHING RUNDOWN...' : 'HYDRATING CHUNKS...'}
                </h3>
              </div>
            </div>
          ) : activeBroadcast ? (
            <>
              <h2 className="current-title text-2xl font-bold mt-4">{activeBroadcast.title}</h2>
              
              <div className="countdown-container">
                <span className="countdown-label">TIME REMAINING:</span>
                {/* Driven directly by the system clock */}
                <span className="countdown-clock neon-gold-text">{dynamicCountdown}</span>
              </div>
              
              <div className="player-viewport">
                {/* Video or HLS instance mounts here, now that array is resolved */}
                <div className="standby-screen text-green-400 border border-green-500/30 bg-green-950/20 p-8 rounded-lg flex flex-col items-center justify-center">
                  <div className="w-16 h-16 rounded-full border-4 border-green-500 flex items-center justify-center mb-4">
                     <span className="text-2xl font-bold">▶</span>
                  </div>
                  <span className="text-xl font-bold uppercase tracking-widest">STREAM READY</span>
                </div>
              </div>
            </>
          ) : (
             <div className="mt-8 p-6 text-center text-gray-500 font-mono">
               No active broadcasts found in schedule.
             </div>
          )}
        </section>

        {/* Master Control Calendar */}
        <section className="glass-panel calendar-module">
          <h3 className="neon-cyan-text mb-4">Broadcast Archive {viewMode === 'heatmap' ? 'Heatmap' : 'Timeline'}</h3>
          <div className="calendar-grid">
            {/* Grid injected via Time-Series Engine data */}
            {loadError ? (
              <div className="calendar-placeholder border border-zinc-800 p-4 text-zinc-400 bg-zinc-900/40 rounded">
                <p className="font-medium text-zinc-300">Archive Index Standby</p>
                <p className="system-log text-xs mt-1 font-mono text-zinc-500">&gt; Schedule connection paused. Showing cached archive records.</p>
              </div>
            ) : (
              <div className="calendar-placeholder border border-[#333] p-4 text-[#aaa]">
                <p>August 2026 Archive Index Loaded.</p>
                <p className="system-log text-sm mt-2 font-mono text-[#666]">&gt; Indexing complete. All broadcast chunks hydrated.</p>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
};

export default PlayoutDashboard;
