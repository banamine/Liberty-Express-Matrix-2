import { useState, useEffect } from 'react';

export interface BroadcastSegment {
  identifier: string;
  title: string;
  start: number;
  duration: number;
  thumbBase: string;
  showId: string;
  addedDate?: string;
}

export interface NetworkRundown {
  channelId: string;
  network: string;
  segments: BroadcastSegment[];
}

export function useStaticRundown() {
  const [rundown, setRundown] = useState<NetworkRundown[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    let fallbackTimeout: ReturnType<typeof setTimeout>;
    const fetchRundown = () => {
      // Memory Clearing: Explicitly nullify the old JSON payload array before the next 24-hour cycle
      setRundown([]);
      setLoading(true);

      const primaryController = new AbortController();
    const primaryTimeout = setTimeout(() => primaryController.abort(), 8000);

    const cacheBuster = `?v=${new Date().toISOString().split('T')[0]}`;

    fetch(`/data/daily-rundown.json${cacheBuster}`, { signal: primaryController.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP_${res.status}: Static JSON not found`);
        const data = await res.json();
        if (!Array.isArray(data)) throw new Error('Invalid JSON shape: expected array');

        const totalSegments = data.reduce(
          (acc: number, net: NetworkRundown) => acc + (net.segments?.length || 0),
          0
        );
        if (totalSegments === 0) throw new Error('Static file contains 0 segments across all networks');

        return data as NetworkRundown[];
      })
      .then((data) => {
        if (isMounted) {
          setRundown(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error(`Static rundown unusable (${err.message}). Falling back to live API...`);

        const fallbackController = new AbortController();
        const fallbackTimeout = setTimeout(() => fallbackController.abort(), 8000);

        fetch('/api/rundown', { signal: fallbackController.signal })
          .then(async (res) => {
            if (!res.ok) throw new Error(`HTTP_${res.status}: Live API failed`);
            const data = await res.json();
            if (!Array.isArray(data)) throw new Error('Invalid live API response shape');
            return data as NetworkRundown[];
          })
          .then((data) => {
            if (isMounted) {
              setRundown(data);
              setLoading(false);
            }
          })
          .catch((fallbackErr) => {
            if (isMounted) {
              console.error('Critical: Both static and live rundowns failed:', fallbackErr);
              setLoading(false);
            }
          })
          .finally(() => clearTimeout(fallbackTimeout));
      })
      .finally(() => clearTimeout(primaryTimeout));
    };

    fetchRundown();
    
    // Fetch the next 24-hour cycle automatically
    const intervalRef = setInterval(fetchRundown, 24 * 60 * 60 * 1000);

    return () => {
      isMounted = false;
      clearInterval(intervalRef);
      setRundown([]); // cleanup on unmount
    };
  }, []);

  return { rundown, loading };
}
