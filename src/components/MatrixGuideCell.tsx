import React from 'react';
import './MatrixGuideCell.css';

interface SpriteMetadata {
  sprite_sheet_url: string;
  total_columns: number;
  total_rows: number;
  target_column_index: number;
  target_row_index: number;
}

interface TimelineSlot {
  slot_id: string;
  start_time_utc: string;
  end_time_utc: string;
  duration_minutes?: number;
  has_visual_preview?: boolean;
  thumbnailUrl?: string;
}

export const MatrixGuideCell: React.FC<{ slot: TimelineSlot; title: string }> = ({ slot, title }) => {
  // Rule 1: Opt-In Feature Flag (has_visual_preview) with thumbnailUrl fallback
  if (!slot.has_visual_preview || !slot.thumbnailUrl) {
    return (
      <div className="matrix-guide-cell fallback-cell bg-ajn-surface-1 flex items-center justify-center text-ajn-text-1 border border-ajn-border">
        <span className="text-xs truncate px-2">{title}</span>
      </div>
    );
  }

  return (
    <div className="matrix-guide-cell border border-ajn-border relative overflow-hidden">
      <img 
        src={slot.thumbnailUrl} 
        alt={title} 
        className="w-full h-full object-cover"
        onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
      />
      <div className="absolute bottom-0 left-0 right-0 bg-black/70 p-2">
        <span className="text-xs text-ajn-text-1 truncate block font-semibold">{title}</span>
      </div>
    </div>
  );
};

