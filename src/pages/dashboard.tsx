import React, { useState, useEffect, useRef } from 'react';
import PlayoutDashboard from '../components/playout/PlayoutDashboard';

export default function Dashboard() {
  const [currentTime, setCurrentTime] = useState(new Date());

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    timerRef.current = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return (
    <div className="flex w-full bg-ajn-bg text-ajn-text-1 font-sans">
      <main className="flex-1 overflow-y-auto xl:p-[var(--ajn-space-8)]">
        <header className="mb-[var(--ajn-space-6)] border-b border-ajn-border pb-[var(--ajn-space-4)] flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold m-0 text-ajn-text-1 tracking-tight">
              Playout Architecture
            </h1>
            <p className="text-base text-ajn-text-2 mt-1">
              Dynamic Content Rotation & Affiliate Sync
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-semibold font-mono text-ajn-accent">
              {currentTime.toLocaleTimeString('en-US', { hour12: false })}
            </div>
            <div className="text-sm text-ajn-text-3">
              {currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </div>
          </div>
        </header>

        <PlayoutDashboard apiEndpoint={window.location.origin} />
      </main>
    </div>
  );
}
