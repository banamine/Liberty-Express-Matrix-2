import { useState, useEffect, useRef } from 'react';
import { BACKEND_URL } from '../config';

export function useWebSocket(url: string) {
  const [connected, setConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<MessageEvent | null>(null);
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    let finalUrl = url;
    if (finalUrl.startsWith('/')) {
       const wsBackend = BACKEND_URL.replace(/^http/, 'ws');
       finalUrl = `${wsBackend}${finalUrl}`;
    }

    const connect = () => {
      ws.current = new WebSocket(finalUrl);

      ws.current.onopen = () => {
        setConnected(true);
      };

      ws.current.onmessage = (event) => {
        setLastMessage(event);
      };

      ws.current.onclose = () => {
        setConnected(false);
        // Reconnect after 3 seconds
        setTimeout(connect, 3000);
      };

      ws.current.onerror = (error) => {
        console.error('WebSocket Error:', error);
      };
    };

    connect();

    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [url]);

  return { connected, lastMessage };
}
