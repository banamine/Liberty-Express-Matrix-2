import React from 'react';

interface SevenDayChannelSelectorProps {
  activeChannel: string;
  onChannelSelect: (channel: string) => void;
}

const SevenDayChannelSelector: React.FC<SevenDayChannelSelectorProps> = ({
  activeChannel,
  onChannelSelect
}) => {
  const days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  
  return (
    <div className="flex flex-col gap-[var(--ajn-space-3)]">
      <h3 className="text-lg font-semibold text-ajn-text-1 m-0 mb-[var(--ajn-space-2)]">Channel Select</h3>
      <div className="flex flex-col gap-[var(--ajn-space-2)]">
        {days.map((day) => {
          const isActive = activeChannel === day;
          return (
            <button
              key={day}
              onClick={() => onChannelSelect(day)}
              className={`flex items-center justify-between px-[var(--ajn-space-4)] py-[var(--ajn-space-3)] rounded-[var(--ajn-radius-md)] text-sm font-medium transition-all ${
                isActive 
                  ? 'bg-ajn-accent text-black shadow-[var(--ajn-shadow-glow)]' 
                  : 'bg-ajn-surface-1 text-ajn-text-2 hover:bg-ajn-surface-2 border border-ajn-border hover:text-ajn-text-1'
              }`}
            >
              <span className="uppercase tracking-wider">{day}</span>
              {isActive && (
                <div className="w-2 h-2 rounded-full bg-black opacity-50" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default SevenDayChannelSelector;
