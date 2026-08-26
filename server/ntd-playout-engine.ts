// ntd-playout-engine.ts
import { computeNextBroadcastShow } from './ntd-schedule';
import { WebSocketServer, WebSocket } from 'ws';

export interface PlayoutState {
  currentChannel: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
  currentFile: string;
  playbackPosition: number; // milliseconds
  isSpecialBroadcast: boolean;
  nextReplacement: {
    date: Date;
    files: string[];
  };
  affiliateClockData: {
    msUntilPreFire: number;
    msUntilShow: number;
    nextBreakWindow: Date;
  };
}

interface DetectedFile {
  filename: string;
  dateStamp: Date;
  dayOfWeek: string;
  title: string;
  isSpecial: boolean;
}

class PlayoutEngine {
  private playoutState: PlayoutState;
  private fileWatcher: NodeJS.Timeout | null = null;
  private scheduleComputer = computeNextBroadcastShow;
  private wss: WebSocketServer | null = null;

  constructor() {
    this.playoutState = this.initializeState();
    this.startFileWatcher();
  }

  public attachWebSocket(wss: WebSocketServer) {
    this.wss = wss;
    this.wss.on('connection', (ws: WebSocket) => {
      ws.send(JSON.stringify({ type: 'state-update', payload: this.playoutState }));
    });
  }

  private initializeState(): PlayoutState {
    const now = new Date();
    const schedule = this.scheduleComputer(now);
    
    const dayOfWeek = now.toLocaleDateString('en-US', { 
      timeZone: 'America/New_York', 
      weekday: 'short' 
    }).toLowerCase() as any;

    return {
      currentChannel: dayOfWeek,
      currentFile: 'placeholder_video.m4v',
      playbackPosition: 0,
      isSpecialBroadcast: false,
      nextReplacement: {
        date: this.getNextWeekdayDate(dayOfWeek),
        files: [],
      },
      affiliateClockData: {
        msUntilPreFire: schedule.msUntilPreFire,
        msUntilShow: schedule.msUntilShow,
        nextBreakWindow: new Date(now.getTime() + schedule.msUntilPreFire),
      },
    };
  }

  private startFileWatcher() {
    this.fileWatcher = setInterval(async () => {
      const newFiles = await this.scanArchiveDirectory();
      
      for (const file of newFiles) {
        if (file.isSpecial) {
          this.handleSpecialBroadcast(file);
        } else if (this.isNextWeekReplacement(file)) {
          this.stageWeeklyReplacement(file);
        }
      }
      
      this.updateAffiliateClock();
      
      // Periodically update playback position to simulate progress
      if (!this.playoutState.isSpecialBroadcast) {
          this.playoutState.playbackPosition += 60000;
          this.broadcastState();
      }
    }, 60000);
  }

  private async scanArchiveDirectory(): Promise<DetectedFile[]> {
    // Mock files for simulation
    return [];
  }

  private handleSpecialBroadcast(file: DetectedFile) {
    console.log(`[PLAYOUT] Special Broadcast Detected: ${file.filename}`);
    
    this.playoutState.isSpecialBroadcast = true;
    this.playoutState.currentFile = file.filename;
    this.playoutState.currentChannel = file.dayOfWeek as any;
    this.playoutState.playbackPosition = 0;

    this.emitDashboardEvent('special-broadcast-activated', {
      filename: file.filename,
      title: file.title,
      timestamp: new Date(),
    });
    this.broadcastState();
  }

  private stageWeeklyReplacement(file: DetectedFile) {
    console.log(`[PLAYOUT] Weekly Replacement Staged: ${file.filename}`);
    
    const cutoverDate = this.getNextWeekdayDate(file.dayOfWeek);
    
    this.playoutState.nextReplacement = {
      date: cutoverDate,
      files: [file.filename],
    };

    this.emitDashboardEvent('replacement-staged', {
      dayOfWeek: file.dayOfWeek,
      cutoverDate,
      fileCount: this.playoutState.nextReplacement.files.length,
    });
    this.broadcastState();
  }

  private isNextWeekReplacement(file: DetectedFile): boolean {
    const nextWeekDate = new Date();
    nextWeekDate.setDate(nextWeekDate.getDate() + 7);
    return file.dateStamp >= nextWeekDate;
  }

  private getNextWeekdayDate(dayOfWeek: string): Date {
    const dayMap: Record<string, number> = {
      mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6, sun: 0
    };
    
    const targetDay = dayMap[dayOfWeek.toLowerCase()];
    const now = new Date();
    const currentDay = now.getDay();
    
    const daysUntilNext = (targetDay - currentDay + 7) % 7 || 7;
    const nextDate = new Date(now);
    nextDate.setDate(nextDate.getDate() + daysUntilNext);
    nextDate.setHours(0, 0, 0, 0);
    
    return nextDate;
  }

  public updateAffiliateClock() {
    const now = new Date();
    const schedule = this.scheduleComputer(now);

    this.playoutState.affiliateClockData = {
      msUntilPreFire: schedule.msUntilPreFire,
      msUntilShow: schedule.msUntilShow,
      nextBreakWindow: new Date(now.getTime() + schedule.msUntilPreFire),
    };
    this.broadcastState();
  }

  public manualRestart() {
    console.log('[MANUAL] Playback Restart Triggered');
    this.playoutState.playbackPosition = 0;
    this.emitDashboardEvent('manual-restart', { timestamp: new Date() });
    this.broadcastState();
  }

  public manualPlaylistSwap(targetChannel: string) {
    console.log(`[MANUAL] Playlist Swap: ${this.playoutState.currentChannel} → ${targetChannel}`);
    this.playoutState.currentChannel = targetChannel as any;
    this.playoutState.playbackPosition = 0;
    this.emitDashboardEvent('playlist-swapped', { 
      newChannel: targetChannel,
      timestamp: new Date(),
    });
    this.broadcastState();
  }

  private emitDashboardEvent(eventType: string, data: any) {
    if (this.wss) {
      this.wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ type: eventType, payload: data }));
        }
      });
    }
  }

  private broadcastState() {
    if (this.wss) {
      this.wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ type: 'state-update', payload: this.playoutState }));
        }
      });
    }
  }

  public getPlayoutState(): PlayoutState {
    return { ...this.playoutState };
  }

  public destroy() {
    if (this.fileWatcher) clearInterval(this.fileWatcher);
  }
}

export const playoutEngine = new PlayoutEngine();
