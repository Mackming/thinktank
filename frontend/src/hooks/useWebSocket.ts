import { useState, useEffect, useRef, useCallback } from 'react';

export interface WebSocketMessage {
  type: string;
  agent_name?: string;
  content?: any;
  message?: string;
  timestamp?: string;
}

export function useWebSocket(url: string) {
  const [messages, setMessages] = useState<WebSocketMessage[]>([]);
  const [status, setStatus] = useState<'connecting' | 'open' | 'closed' | 'error'>('connecting');
  const ws = useRef<WebSocket | null>(null);

  const connect = useCallback(() => {
    setStatus('connecting');
    ws.current = new WebSocket(url);

    ws.current.onopen = () => setStatus('open');
    ws.current.onclose = () => {
      setStatus('closed');
      // Auto-reconnect after 3 seconds
      setTimeout(connect, 3000);
    };
    ws.current.onerror = () => setStatus('error');
    ws.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setMessages((prev) => [...prev, data]);
      } catch (err) {
        console.error("Failed to parse WebSocket message", err);
      }
    };
  }, [url]);

  useEffect(() => {
    connect();
    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [connect]);

  const sendMessage = useCallback((payload: object) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(payload));
    } else {
      console.warn("Cannot send message, WebSocket is not open");
    }
  }, []);

  return { messages, status, sendMessage };
}
