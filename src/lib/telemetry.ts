export type LogLevel = 'info' | 'warn' | 'error' | 'debug';
export type LogCategory = 'search' | 'queue' | 'playback' | 'system' | 'network' | 'ui';

export interface TelemetryEvent {
  id: string;
  timestamp: number;
  level: LogLevel;
  category: LogCategory;
  message: string;
  data?: any;
  correlationId?: string;
}

const MAX_EVENTS = 10000;
const PURGE_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

class TelemetryLogger {
  private events: TelemetryEvent[] = [];
  private listeners: Set<() => void> = new Set();
  private pendingPayloads: TelemetryEvent[] = [];
  private syncTimer: any = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.refreshFromServer();
      window.setInterval(() => {
        this.refreshFromServer();
      }, 30000); // refresh every 30s
    }
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener());
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getEvents(): TelemetryEvent[] {
    return [...this.events];
  }
  
  public async refreshFromServer() {
    if (typeof window === 'undefined') return;
    try {
      const res = await fetch('/api/telemetry');
      if (res.ok) {
        const data = await res.json();
        if (data.events) {
          this.events = data.events;
          this.notifyListeners();
        }
      }
    } catch(e) {
      console.warn("Failed to fetch telemetry from server");
    }
  }

  private scheduleSync() {
    if (typeof window === 'undefined') return;
    if (this.syncTimer) return;
    this.syncTimer = setTimeout(async () => {
      const payloads = [...this.pendingPayloads];
      this.pendingPayloads = [];
      this.syncTimer = null;
      if (payloads.length === 0) return;
      try {
        await fetch('/api/telemetry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ events: payloads })
        });
        // We do not await refresh here immediately to save overhead,
        // it will just rely on the local cache + next refresh
      } catch (e) {
        console.warn('Failed to sync telemetry to server', e);
        // put back if failed
        this.pendingPayloads.push(...payloads);
      }
    }, 1000);
  }

  public log(level: LogLevel, category: LogCategory, message: string, data?: any) {
    const correlationId = data && data.correlationId ? data.correlationId : undefined;
    const event: TelemetryEvent = {
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2),
      timestamp: Date.now(),
      level,
      category,
      message,
      data: data ? JSON.parse(JSON.stringify(data)) : undefined, // deep copy
      correlationId
    };

    // Keep locally
    this.events.unshift(event);
    if (this.events.length > MAX_EVENTS) {
      this.events = this.events.slice(0, MAX_EVENTS);
    }
    
    // Add to pending payloads for server
    this.pendingPayloads.push(event);
    this.scheduleSync();

    if (process.env.NODE_ENV !== 'production') {
      const consoleMsg = `[${level.toUpperCase()}] [${category}] ${message}`;
      if (level === 'error') console.error(consoleMsg, data || '');
      else if (level === 'warn') console.warn(consoleMsg, data || '');
      else if (level === 'info') console.info(consoleMsg, data || '');
      else console.debug(consoleMsg, data || '');
    }

    this.notifyListeners();
  }

  public info(category: LogCategory, message: string, data?: any) {
    this.log('info', category, message, data);
  }

  public warn(category: LogCategory, message: string, data?: any) {
    this.log('warn', category, message, data);
  }

  public error(category: LogCategory, message: string, data?: any) {
    this.log('error', category, message, data);
  }

  public debug(category: LogCategory, message: string, data?: any) {
    this.log('debug', category, message, data);
  }

  public clear() {
    this.events = [];
    this.notifyListeners();
    // (Optional) Server clear not implemented yet
  }

  public exportAsString(): string {
    return this.events.map(e => {
      const d = new Date(e.timestamp).toISOString();
      const dataStr = e.data ? ` | Data: ${JSON.stringify(e.data)}` : '';
      return `[${d}] [${e.level.toUpperCase()}] [${e.category}] ${e.message}${dataStr}`;
    }).join('\n');
  }
}

export const telemetry = new TelemetryLogger();
