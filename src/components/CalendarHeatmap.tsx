import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { TimeSeriesEntry } from "../../shared/schema";

interface CalendarHeatmapProps {
  onSelectDate: (date: Date) => void;
}

export function CalendarHeatmap({ onSelectDate }: CalendarHeatmapProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1; // 1-12
  
  const { data, isLoading } = useQuery<{ entries: TimeSeriesEntry[] }>({
    queryKey: ["/api/time-series", year, month],
    staleTime: 60000,
    retry: 1,
    queryFn: async () => {
      const res = await fetch(`/api/time-series/${year}/${month}`);
      if (!res.ok) throw new Error("Failed to load time series");
      return res.json();
    }
  });

  const getDaysInMonth = (y: number, m: number) => new Date(y, m, 0).getDate();
  const getFirstDayOfMonth = (y: number, m: number) => new Date(y, m - 1, 1).getDay();

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const prevMonth = () => {
    setCurrentDate(new Date(year, currentDate.getMonth() - 1, 1));
  };
  const nextMonth = () => {
    setCurrentDate(new Date(year, currentDate.getMonth() + 1, 1));
  };

  const entries = data?.entries || [];
  
  // Aggregate status by day
  const heatmap: Record<number, { count: number, status: string }> = {};
  for (let i = 1; i <= daysInMonth; i++) {
    heatmap[i] = { count: 0, status: 'EMPTY' };
  }
  
  entries.forEach(entry => {
    const entryDate = new Date(entry.timestamp);
    if (entryDate.getFullYear() === year && (entryDate.getMonth() + 1) === month) {
      const day = entryDate.getDate();
      heatmap[day].count++;
      // Priority status for the dot
      if (entry.status === 'PLAYING_NOW') heatmap[day].status = 'LIVE';
      else if (heatmap[day].status !== 'LIVE' && entry.status === 'ARCHIVED') heatmap[day].status = 'ARCHIVED';
      else if (heatmap[day].status === 'EMPTY') heatmap[day].status = entry.status;
    }
  });

  const days = [];
  for (let i = 0; i < firstDay; i++) {
    days.push(<div key={`empty-${i}`} className="h-24 bg-zinc-950/40 border border-zinc-900" />);
  }

  for (let i = 1; i <= daysInMonth; i++) {
    const isToday = new Date().getFullYear() === year && new Date().getMonth() + 1 === month && new Date().getDate() === i;
    const { count, status } = heatmap[i];
    
    let dotColor = "bg-zinc-700";
    if (status === 'LIVE') dotColor = "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]";
    else if (status === 'ARCHIVED') dotColor = "bg-emerald-500";
    else if (status === 'PLAYED_YESTERDAY' || status === 'PLAYED_LAST_HOUR') dotColor = "bg-blue-400";
    else if (status === 'UPCOMING_NEXT' || status === 'QUEUED_FUTURE') dotColor = "bg-orange-400";
    
    days.push(
      <div 
        key={`day-${i}`} 
        onClick={() => onSelectDate(new Date(year, month - 1, i))}
        className={`h-24 p-2 relative bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 transition-colors cursor-pointer group ${isToday ? 'ring-1 ring-emerald-500' : ''}`}
      >
        <span className={`text-sm font-semibold ${isToday ? 'text-emerald-400' : 'text-zinc-400 group-hover:text-zinc-200'}`}>{i}</span>
        {count > 0 && (
          <div className="absolute bottom-2 left-2 right-2 flex justify-between items-center">
            <span className="text-[10px] text-zinc-500">{count} files</span>
            <div className={`w-2.5 h-2.5 rounded-full ${dotColor}`} title={status} />
          </div>
        )}
        {count === 0 && (
          <div className="absolute bottom-2 right-2 w-2.5 h-2.5 rounded-full bg-red-900/40 border border-red-900/60" title="Missing files" />
        )}
      </div>
    );
  }

  const monthName = currentDate.toLocaleString('default', { month: 'long' });

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
          Broadcast Archive Heatmap
        </h2>
        <div className="flex items-center gap-4 bg-zinc-900 p-1 rounded-md border border-zinc-800">
          <button onClick={prevMonth} className="p-1 min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-zinc-800 rounded text-zinc-400"><ChevronLeft className="w-5 h-5" /></button>
          <span className="text-sm font-medium w-32 text-center text-zinc-200">{monthName} {year}</span>
          <button onClick={nextMonth} className="p-1 min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-zinc-800 rounded text-zinc-400"><ChevronRight className="w-5 h-5" /></button>
        </div>
      </div>
      
      <div className="grid grid-cols-7 gap-1">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} className="text-center text-xs font-semibold text-zinc-500 py-2">
            {d}
          </div>
        ))}
        {days}
      </div>
      
      <div className="mt-8 flex gap-6 px-2 border-t border-zinc-800 pt-6">
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-emerald-500" /><span className="text-xs text-zinc-400">Archived</span></div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-blue-400" /><span className="text-xs text-zinc-400">Recently Played</span></div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" /><span className="text-xs text-zinc-400">Live Now</span></div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-orange-400" /><span className="text-xs text-zinc-400">Queued Future</span></div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-900/40 border border-red-900/60" /><span className="text-xs text-zinc-400">Missing</span></div>
      </div>
    </div>
  );
}
