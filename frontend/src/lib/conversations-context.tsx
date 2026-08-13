"use client";

import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from "react";
import { api } from "./api";
import { useAuth } from "./auth-context";
import { useWs, WsEvent } from "./ws-context";
import type { Conversation } from "./types";

interface ConversationsContextValue {
  conversations: Conversation[];
  loading: boolean;
  refresh: () => Promise<void>;
  activeConversationId: string | null;
  setActiveConversationId: (id: string | null) => void;
  upsertConversation: (conv: Conversation) => void;
  typingMap: Record<string, string[]>; // conversation_id -> list of user display names typing
}

const ConversationsContext = createContext<ConversationsContextValue | undefined>(undefined);

export function ConversationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { subscribe } = useWs();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const conversationsRef = useRef<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const activeIdRef = useRef<string | null>(null);
  activeIdRef.current = activeConversationId;
  const [typingMap, setTypingMap] = useState<Record<string, string[]>>({});
  const typingTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      const data = await api.listConversations();
      setConversations(data);
    } catch (err) {
      console.error("Failed to list conversations:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) refresh();
  }, [user, refresh]);

  const upsertConversation = useCallback((conv: Conversation) => {
    setConversations((prev) => {
      const idx = prev.findIndex((c) => c.id === conv.id);
      if (idx === -1) return [conv, ...prev];
      const next = [...prev];
      next[idx] = conv;
      return next.sort((a, b) => (a.last_message_at < b.last_message_at ? 1 : -1));
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribe((evt: WsEvent) => {
      if (evt.type === "new_message") {
        const msg = evt.message;
        setConversations((prev) => {
          const idx = prev.findIndex((c) => c.id === msg.conversation_id);
          if (idx === -1) return prev;
          const conv = prev[idx];
          const isActive = activeIdRef.current === conv.id;
          const isMine = msg.sender_id === user.id;
          const updated: Conversation = {
            ...conv,
            last_message_at: msg.created_at,
            last_message: {
              content: msg.content,
              sender_id: msg.sender_id,
              created_at: msg.created_at,
              status: msg.status,
            },
            unread_count: !isMine && !isActive ? conv.unread_count + 1 : conv.unread_count,
          };
          const next = [...prev];
          next.splice(idx, 1);
          return [updated, ...next];
        });
        // Clear typing for this user in this conversation
        setTypingMap((prev) => {
          const conv = conversationsRef.current.find((c) => c.id === msg.conversation_id);
          const convTyping = (prev[msg.conversation_id] || []).filter((name) => {
            const participant = conv?.participants.find((p) => p.user.display_name === name);
            return participant?.user.id !== msg.sender_id;
          });
          return { ...prev, [msg.conversation_id]: convTyping };
        });
      } else if (evt.type === "presence") {
        setConversations((prev) =>
          prev.map((c) => ({
            ...c,
            participants: c.participants.map((p) =>
              p.user.id === evt.user_id
                ? { ...p, user: { ...p.user, is_online: evt.is_online, last_seen: evt.last_seen ?? p.user.last_seen } }
                : p
            ),
          }))
        );
      } else if (evt.type === "typing") {
        const conv = conversationsRef.current.find((c) => c.id === evt.conversation_id);
        const displayName = conv?.participants.find((p) => p.user.id === evt.user_id)?.user.display_name;
        if (!displayName) return;

        setTypingMap((prevMap) => {
          const current = prevMap[evt.conversation_id] || [];
          if (evt.is_typing) {
            if (!current.includes(displayName)) {
              return { ...prevMap, [evt.conversation_id]: [...current, displayName] };
            }
          } else {
            return { ...prevMap, [evt.conversation_id]: current.filter((n) => n !== displayName) };
          }
          return prevMap;
        });

        // Auto-clear after 5s to avoid stuck typing state if a stop event is lost.
        const key = `${evt.conversation_id}_${evt.user_id}`;
        if (typingTimers.current[key]) clearTimeout(typingTimers.current[key]);
        if (evt.is_typing) {
          typingTimers.current[key] = setTimeout(() => {
            setTypingMap((prevMap) => ({
              ...prevMap,
              [evt.conversation_id]: (prevMap[evt.conversation_id] || []).filter((n) => n !== displayName),
            }));
          }, 5000);
        }
      }
    });
    return unsub;
  }, [user, subscribe]);

  return (
    <ConversationsContext.Provider
      value={{ conversations, loading, refresh, activeConversationId, setActiveConversationId, upsertConversation, typingMap }}
    >
      {children}
    </ConversationsContext.Provider>
  );
}

export function useConversations() {
  const ctx = useContext(ConversationsContext);
  if (!ctx) throw new Error("useConversations must be used within ConversationsProvider");
  return ctx;
}
