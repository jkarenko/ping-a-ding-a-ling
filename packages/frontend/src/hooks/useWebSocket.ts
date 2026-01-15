import { useEffect, useRef, useCallback } from 'react';
import type { SessionSettings, ClientMessage } from '@ping/shared';
import { useSessionStore } from '../stores/session.store';

type WSStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const statusRef = useRef<WSStatus>('disconnected');
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const {
    startSession,
    endSession,
    addPingResult,
    addDeviation,
    triggerFlash,
  } = useSessionStore();

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    // Determine WebSocket URL based on current location
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws`;

    statusRef.current = 'connecting';
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      statusRef.current = 'connected';
      console.log('WebSocket connected');
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        handleMessage(message);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    ws.onerror = (error) => {
      statusRef.current = 'error';
      console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
      statusRef.current = 'disconnected';
      console.log('WebSocket disconnected');

      // Attempt to reconnect after 2 seconds
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 2000);
    };

    wsRef.current = ws;
  }, []);

  const handleMessage = useCallback(
    (message: { type: string; payload: unknown }) => {
      switch (message.type) {
        case 'session_started':
          startSession(message.payload as Parameters<typeof startSession>[0]);
          break;

        case 'session_ended':
          const endPayload = message.payload as { sessionId: string; stats: Parameters<typeof endSession>[0] };
          endSession(endPayload.stats);
          break;

        case 'ping_result':
          addPingResult(message.payload as Parameters<typeof addPingResult>[0]);
          break;

        case 'deviation':
          addDeviation(message.payload as Parameters<typeof addDeviation>[0]);
          triggerFlash();
          break;

        case 'error':
          const errorPayload = message.payload as { message: string };
          console.error('Server error:', errorPayload.message);
          break;
      }
    },
    [startSession, endSession, addPingResult, addDeviation, triggerFlash]
  );

  const sendMessage = useCallback((message: ClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket not connected');
    }
  }, []);

  const startPingSession = useCallback(
    (settings: SessionSettings) => {
      sendMessage({ type: 'start_session', settings });
    },
    [sendMessage]
  );

  const stopPingSession = useCallback(() => {
    sendMessage({ type: 'stop_session' });
  }, [sendMessage]);

  const updateSettings = useCallback(
    (settings: Partial<SessionSettings>) => {
      sendMessage({ type: 'update_settings', settings });
    },
    [sendMessage]
  );

  // Connect on mount
  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  return {
    startPingSession,
    stopPingSession,
    updateSettings,
    getStatus: () => statusRef.current,
  };
}
