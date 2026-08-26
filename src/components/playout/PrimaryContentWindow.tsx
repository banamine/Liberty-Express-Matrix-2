import React from 'react';
import { Zap, Image as ImageIcon } from 'lucide-react';

interface PrimaryContentWindowProps {
  currentFile: string;
  playbackPosition: number;
  isSpecial: boolean;
}

const PrimaryContentWindow: React.FC<PrimaryContentWindowProps> = ({
  currentFile,
  playbackPosition,
  isSpecial
}) => {
  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col h-full bg-ajn-surface-1 rounded-[var(--ajn-radius-lg)] border border-ajn-border overflow-hidden shadow-[var(--ajn-shadow-soft)]">
      {/* Video/Image Region */}
      <div className={`relative h-60 md:h-80 lg:h-[400px] flex items-center justify-center ${isSpecial ? 'bg-gradient-to-br from-[#4a0404] to-[#1a1a1a]' : 'bg-gradient-to-br from-[#022c22] to-[#1a1a1a]'}`}>
        <div className="absolute top-[var(--ajn-space-4)] left-[var(--ajn-space-4)]">
          <span className={`inline-flex items-center px-2 py-1 rounded-[var(--ajn-radius-sm)] text-[var(--ajn-text-xs)] font-bold tracking-wider uppercase ${isSpecial ? 'bg-ajn-warn text-white' : 'bg-ajn-live text-black'}`}>
            {isSpecial ? 'Override: Special' : 'LIVE: Weekday Loop'}
          </span>
        </div>
        <div className="absolute top-[var(--ajn-space-4)] right-[var(--ajn-space-4)]">
          <span className="inline-flex items-center px-2 py-1 rounded-[var(--ajn-radius-sm)] text-[var(--ajn-text-xs)] font-bold tracking-wider uppercase bg-ajn-surface-2 text-ajn-text-2 border border-ajn-border">
            H.264 / 1080p
          </span>
        </div>
        
        {/* Big center icon */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {isSpecial ? (
            <Zap size={100} className="text-ajn-warn opacity-30" />
          ) : (
            <ImageIcon size={100} className="text-ajn-live opacity-30" />
          )}
        </div>

        {/* Placeholder for video player or hero graphic */}
        <div className="relative z-10 flex flex-col items-center">
          <div className="text-ajn-text-3 mb-2 font-mono text-xl bg-black/40 px-3 py-1 rounded-md backdrop-blur-sm">
            {formatTime(playbackPosition)}
          </div>
          <div className="text-ajn-text-2 opacity-70 tracking-widest uppercase font-semibold text-sm">
            Playout Feed
          </div>
        </div>
      </div>

      {/* Metadata & Actions */}
      <div className="p-[var(--ajn-space-5)] flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h3 className="text-2xl font-bold m-0 mb-[var(--ajn-space-2)] text-ajn-text-1">
            {isSpecial ? 'Special Edition Broadcast' : currentFile || 'No Content Loaded'}
          </h3>
          <p className="text-ajn-text-2 m-0 text-sm max-w-[400px] leading-relaxed">
            {isSpecial 
               ? 'Detected special file in /hourly-m4v/. Weekday rotation interrupted.' 
               : "Standard loop active. Auto-replacing on next Monday with new week's files."}
          </p>
        </div>
      </div>
    </div>
  );
};

export default PrimaryContentWindow;
