"use client";

import { createContext, useContext, useEffect, useRef, useState, ReactNode, useCallback } from "react";
import { useAuth } from "./auth-context";
import type { MessageStatus } from "./types";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000";

export type WsEvent =
  | { type: "new_message"; message: import("./types").Message }
  | { type: "typing"; conversation_id: string; user_id: string; is_typing: boolean }
  | { type: "presence"; user_id: string; is_online: boolean; last_seen?: string }
  | { type: "read_receipt"; conversation_id: string; reader_id: string; message_ids: string[] }
  | { type: "delivery_update"; conversation_id: string; message_ids: string[]; status: MessageStatus }
  | { type: "error"; message: string }
  | { type: "pong" };

type Listener = (event: WsEvent) => void;

interface WsContextValue {
  connected: boolean;
  sendMessage: (conversationId: string, content: string, replyToId?: string, clientTempId?: string) => void;
  sendTyping: (conversationId: string, isTyping: boolean) => void;
  subscribe: (listener: Listener) => () => void;
}

const WsContext = createContext<WsContextValue | undefined>(undefined);

export function WsProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const listenersRef = useRef<Set<Listener>>(new Set());
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryDelay = useRef(1000);

  const connect = useCallback(() => {
    if (!token) return;
    const ws = new WebSocket(`${WS_URL}/ws?token=${encodeURIComponent(token)}`);

    ws.onopen = () => {
      setConnected(true);
      retryDelay.current = 1000;
    };

    ws.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data) as WsEvent;
        listenersRef.current.forEach((l) => l(data));
      } catch {
        // ignore malformed
      }
    };

    ws.onclose = () => {
      setConnected(false);
      wsRef.current = null;
      // exponential backoff reconnect, capped at 15s
      reconnectTimer.current = setTimeout(() => {
        retryDelay.current = Math.min(retryDelay.current * 1.5, 15000);
        connect();
      }, retryDelay.current);
    };

    ws.onerror = () => {
      ws.close();
    };

    wsRef.current = ws;
  }, [token]);

  useEffect(() => {
    if (token) {
      connect();
    }
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const sendMessage = useCallback(
    (conversationId: string, content: string, replyToId?: string, clientTempId?: string) => {
      wsRef.current?.send(
        JSON.stringify({
          type: "send_message",
          conversation_id: conversationId,
          content,
          reply_to_id: replyToId,
          client_temp_id: clientTempId,
        })
      );
    },
    []
  );

  const sendTyping = useCallback((conversationId: string, isTyping: boolean) => {
    wsRef.current?.send(
      JSON.stringify({ type: "typing", conversation_id: conversationId, is_typing: isTyping })
    );
  }, []);

  const subscribe = useCallback((listener: Listener) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  return (
    <WsContext.Provider value={{ connected, sendMessage, sendTyping, subscribe }}>
      {children}
    </WsContext.Provider>
  );
}

export function useWs() {
  const ctx = useContext(WsContext);
  if (!ctx) throw new Error("useWs must be used within WsProvider");
  return ctx;
}
