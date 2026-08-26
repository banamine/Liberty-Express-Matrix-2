import React from 'react';
import { Clock } from 'lucide-react';

interface AffiliateClockSyncPanelProps {
  clockData: {
    msUntilPreFire: number;
    msUntilShow: number;
    nextBreakWindow: string | Date;
  };
  connected: boolean;
}

const AffiliateClockSyncPanel: React.FC<AffiliateClockSyncPanelProps> = ({
  clockData,
  connected
}) => {
  const nextBreak = new Date(clockData.nextBreakWindow);
  
  return (
    <div className="bg-ajn-surface-1 rounded-[var(--ajn-radius-lg)] border border-ajn-border p-[var(--ajn-space-5)]">
      <div className="flex items-center gap-[var(--ajn-space-2)] mb-[var(--ajn-space-4)] text-ajn-text-1">
        <Clock size={20} className="text-ajn-accent" />
        <h3 className="m-0 text-lg font-semibold">Affiliate Sync</h3>
      </div>
      
      <div className="mb-[var(--ajn-space-4)]">
        <div className="text-[var(--ajn-text-xs)] uppercase tracking-wider text-ajn-text-3 mb-[var(--ajn-space-1)]">
          Telemetry Status
        </div>
        <div className="flex items-center gap-[var(--ajn-space-2)]">
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-ajn-live' : 'bg-ajn-warn'}`} />
          <span className="font-medium text-sm text-ajn-text-1">
            {connected ? 'Publishing Timing Data' : 'Offline'}
          </span>
        </div>
      </div>
      
      <div className="mb-[var(--ajn-space-4)]">
        <div className="text-[var(--ajn-text-xs)] uppercase tracking-wider text-ajn-text-3 mb-[var(--ajn-space-1)]">
          Next News Break
        </div>
        <div className="font-mono text-ajn-text-1 text-lg tracking-wider">
          {nextBreak.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
      
      <p className="text-sm text-ajn-text-2 leading-relaxed m-0 border-t border-ajn-border pt-[var(--ajn-space-4)]">
        Maintained 15-minute intervals even during infinite-loop playback. Feeds news breaks dev team.
      </p>
    </div>
  );
};

export default AffiliateClockSyncPanel;
