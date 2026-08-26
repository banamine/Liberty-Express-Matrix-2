import React from 'react';
import { Play, Radio, RotateCcw, RefreshCw, Settings } from 'lucide-react';

interface ManualControlsPanelProps {
  onRestart: () => void;
  onBreakOverride: () => void;
  isSpecialMode: boolean;
}

const ManualControlsPanel: React.FC<ManualControlsPanelProps> = ({
  onRestart,
  onBreakOverride,
  isSpecialMode
}) => {
  return (
    <div className="bg-ajn-surface-1 rounded-[var(--ajn-radius-lg)] border border-ajn-border p-[var(--ajn-space-5)] h-full">
      <div className="flex items-center gap-[var(--ajn-space-2)] mb-[var(--ajn-space-4)] text-ajn-text-1">
        <Settings size={20} className="text-ajn-text-2" />
        <h3 className="m-0 text-lg font-semibold">Manual Control</h3>
      </div>
      
      <div className="flex flex-col gap-[var(--ajn-space-3)]">
        <button 
          onClick={onRestart}
          className="flex items-center gap-3 px-[var(--ajn-space-4)] py-[var(--ajn-space-3)] bg-ajn-surface-2 hover:bg-ajn-surface-3 border border-ajn-border rounded-[var(--ajn-radius-md)] text-ajn-text-1 text-sm font-medium transition-colors text-left"
        >
          <RotateCcw size={16} className="text-ajn-text-2" />
          <span>Force Restart Playout</span>
        </button>
        
        <button 
          onClick={onBreakOverride}
          className="flex items-center gap-3 px-[var(--ajn-space-4)] py-[var(--ajn-space-3)] bg-ajn-surface-2 hover:bg-ajn-surface-3 border border-ajn-border rounded-[var(--ajn-radius-md)] text-ajn-text-1 text-sm font-medium transition-colors text-left"
        >
          <Radio size={16} className="text-ajn-text-2" />
          <span>Inject News Break</span>
        </button>

        <button 
          onClick={() => {}}
          className={`flex items-center gap-3 px-[var(--ajn-space-4)] py-[var(--ajn-space-3)] border rounded-[var(--ajn-radius-md)] text-sm font-medium transition-colors text-left mt-2 ${
            isSpecialMode 
              ? 'bg-ajn-accent text-black border-transparent hover:bg-ajn-accent-2 shadow-[var(--ajn-shadow-glow)]'
              : 'bg-ajn-surface-2 text-ajn-text-1 border-ajn-border hover:bg-ajn-surface-3'
          }`}
        >
          {isSpecialMode ? <RefreshCw size={16} /> : <Play size={16} className="text-ajn-text-2" />}
          <span>{isSpecialMode ? 'Resume Rotation' : 'Trigger Special Overrride'}</span>
        </button>
      </div>
    </div>
  );
};

export default ManualControlsPanel;
