import React from 'react';
import { FileSearch } from 'lucide-react';

interface ContentDetectionPanelProps {
  nextReplacement: {
    date: string | Date;
    files: string[];
  };
  isSpecial: boolean;
}

const ContentDetectionPanel: React.FC<ContentDetectionPanelProps> = ({
  nextReplacement,
  isSpecial
}) => {
  const dateObj = new Date(nextReplacement.date);
  
  return (
    <div className="bg-ajn-surface-1 rounded-[var(--ajn-radius-lg)] border border-ajn-border p-[var(--ajn-space-5)]">
      <div className="flex items-center gap-[var(--ajn-space-2)] mb-[var(--ajn-space-4)] text-ajn-text-1">
        <FileSearch size={20} className="text-ajn-accent" />
        <h3 className="m-0 text-lg font-semibold">File Detection</h3>
      </div>
      
      <div className="mb-[var(--ajn-space-4)]">
        <div className="text-[var(--ajn-text-xs)] uppercase tracking-wider text-ajn-text-3 mb-[var(--ajn-space-1)]">
          Directory Poll Status
        </div>
        <div className="flex items-center gap-[var(--ajn-space-2)]">
          <div className="w-2 h-2 rounded-full bg-ajn-live animate-pulse" />
          <span className="font-medium text-sm text-ajn-text-1">Active (60s)</span>
        </div>
      </div>
      
      <div className="mb-[var(--ajn-space-4)]">
        <div className="text-[var(--ajn-text-xs)] uppercase tracking-wider text-ajn-text-3 mb-[var(--ajn-space-1)]">
          Next Auto-Replacement
        </div>
        <div className="font-mono text-ajn-text-1 text-base">
          {dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
        </div>
        <div className="text-sm text-ajn-text-2 mt-[var(--ajn-space-1)]">
          {nextReplacement.files.length} files staged
        </div>
      </div>
      
      {isSpecial && (
        <div className="mt-[var(--ajn-space-4)] p-[var(--ajn-space-3)] bg-ajn-warn/10 border border-ajn-warn/20 rounded-[var(--ajn-radius-md)]">
          <div className="text-ajn-warn text-sm font-semibold mb-1">Interrupt Active</div>
          <div className="text-ajn-text-2 text-xs">Special file detected and overriding standard schedule.</div>
        </div>
      )}
    </div>
  );
};

export default ContentDetectionPanel;
