// src/components/PlaylistUI.tsx
import React, { useState, useEffect } from "react";
import { Trash2, RefreshCcw, Tv } from "lucide-react";
import { Button } from "./ui/button";
import { toast } from "sonner";
import { telemetry, LogLevel, LogCategory } from "../lib/telemetry";

export interface PlaylistItem {
  id: number;
  title: string;
  duration: number;
  status: string;
}

export function PlaylistUI() {
  const [playlist, setPlaylist] = useState<PlaylistItem[]>([]);
  const [isClearing, setIsClearing] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchPlaylist = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/playlist");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setPlaylist(data);
      telemetry.log('info' as LogLevel, 'system' as LogCategory, "Playlist data fetched successfully.");
    } catch (error: any) {
      telemetry.log('error' as LogLevel, 'system' as LogCategory, `Error fetching playlist: ${error.message}`);
      toast.error("Failed to load playlist data.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPlaylist();
  }, []);

  const handleClearPlaylist = async () => {
    setIsClearing(true);
    try {
      telemetry.log('info' as LogLevel, 'system' as LogCategory, "User requested to clear playlist.");
      
      // AWAIT SERVER DELETION BEFORE CLEARING UI
      const response = await fetch("/api/playlist/clear", { 
        method: "DELETE",
        headers: {
          "Content-Type": "application/json"
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to clear playlist on the server.");
      }

      // NOW clear the UI
      setPlaylist([]);
      toast.success("Playlist permanently cleared.");
      telemetry.log('info' as LogLevel, 'system' as LogCategory, "Playlist UI state cleared after server confirmation.");
    } catch (error: any) {
      telemetry.log('error' as LogLevel, 'system' as LogCategory, `Error clearing playlist: ${error.message}`);
      toast.error(`Could not clear playlist: ${error.message}`);
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="flex flex-col w-full max-w-4xl p-6 bg-slate-900 rounded-lg shadow-xl border border-slate-800 text-slate-100">
      <div className="flex items-center justify-between mb-6 border-b border-slate-700 pb-4">
        <div className="flex items-center gap-3">
          <Tv className="w-6 h-6 text-blue-400" />
          <h2 className="text-xl font-bold tracking-tight">Active Playlist</h2>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={fetchPlaylist} 
            disabled={isLoading || isClearing}
            variant="outline"
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border-slate-600"
          >
            <RefreshCcw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button 
            onClick={handleClearPlaylist} 
            disabled={isClearing || playlist.length === 0}
            variant="destructive"
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white"
          >
            <Trash2 className="w-4 h-4" />
            {isClearing ? "Clearing..." : "Clear Playlist"}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2 min-h-[200px]">
        {isLoading ? (
          <div className="flex items-center justify-center h-full w-full py-12 text-slate-400">
            <RefreshCcw className="w-8 h-8 animate-spin" />
          </div>
        ) : playlist.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full w-full py-12 text-slate-500 bg-slate-800/50 rounded border border-slate-700/50 border-dashed">
            <Tv className="w-12 h-12 mb-3 opacity-20" />
            <p className="text-lg font-medium">Playlist is empty</p>
            <p className="text-sm">Queue items to see them here.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2 overflow-y-auto max-h-[500px] pr-2">
            {playlist.map((item, index) => (
              <div 
                key={`${item.id}-${index}`} 
                className="flex items-center justify-between p-4 bg-slate-800 rounded border border-slate-700 hover:border-slate-600 transition-colors"
              >
                <div className="flex flex-col">
                  <span className="font-semibold text-slate-200">{item.title}</span>
                  <span className="text-xs text-slate-400 font-mono">
                    ID: {item.id} | Status: {item.status} | Duration: {item.duration}s
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
