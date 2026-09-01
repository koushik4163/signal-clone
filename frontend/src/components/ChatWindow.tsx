"use client";
/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useWs, WsEvent } from "@/lib/ws-context";
import { useConversations } from "@/lib/conversations-context";
import type { Conversation, Message } from "@/lib/types";
import Avatar from "./Avatar";
import MessageBubble from "./MessageBubble";
import { formatLastSeen } from "@/lib/format";
import GroupInfoModal from "./GroupInfoModal";
import UserProfileModal from "./UserProfileModal";
import EmojiPicker, { Theme } from "emoji-picker-react";

function isSameDay(a: string, b: string) {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

function formatDateSeparator(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return "Today";
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
}

export default function ChatWindow({ conversationId }: { conversationId: string }) {
  const { user } = useAuth();
  const { sendMessage, sendTyping, subscribe, connected } = useWs();
  const { conversations, setActiveConversationId, upsertConversation, refresh } = useConversations();
  const router = useRouter();

  const [conversation, setConversation] = useState<Conversation | null>(
    conversations.find((c) => c.id === conversationId) || null
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editingMsg, setEditingMsg] = useState<Message | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [gifQuery, setGifQuery] = useState("");
  const [gifUrl, setGifUrl] = useState("");
  const [gifResults, setGifResults] = useState<string[]>([]);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = JSON.parse(window.localStorage.getItem("signal_clone_favorites") || "[]");
      return Array.isArray(raw) ? raw : [];
    } catch {
      return [];
    }
  });
  const [clearedChatIds, setClearedChatIds] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = JSON.parse(window.localStorage.getItem("signal_clone_cleared_chats") || "[]");
      return Array.isArray(raw) ? raw : [];
    } catch {
      return [];
    }
  });
  const [blockedIds, setBlockedIds] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = JSON.parse(window.localStorage.getItem("signal_clone_blocked_users") || "[]");
      return Array.isArray(raw) ? raw : [];
    } catch {
      return [];
    }
  });

  // Search
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Message[]>([]);
  const [searchResultIdx, setSearchResultIdx] = useState(0);
  const [searching, setSearching] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasTypingRef = useRef(false);
  const isNearBottomRef = useRef(true);
  const msgRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const skipNextLoadRef = useRef(false);

  const preferences = typeof window !== "undefined"
    ? JSON.parse(window.localStorage.getItem("signal_clone_preferences") || "{}")
    : { onlineStatus: true, readReceipts: true, compactMode: false };

  // Sync conversation from context
  useEffect(() => {
    const c = conversations.find((c) => c.id === conversationId);
    if (c) setConversation(c);
  }, [conversations, conversationId]);

  useEffect(() => {
    setActiveConversationId(conversationId);
    return () => setActiveConversationId(null);
  }, [conversationId, setActiveConversationId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("signal_clone_favorites", JSON.stringify(favoriteIds));
  }, [favoriteIds]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const syncFavorites = () => {
      try {
        const raw = JSON.parse(window.localStorage.getItem("signal_clone_favorites") || "[]");
        setFavoriteIds(Array.isArray(raw) ? raw : []);
      } catch {
        setFavoriteIds([]);
      }
    };

    window.addEventListener("signal_clone_favorites_changed", syncFavorites);
    return () => window.removeEventListener("signal_clone_favorites_changed", syncFavorites);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("signal_clone_blocked_users", JSON.stringify(blockedIds));
  }, [blockedIds]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("signal_clone_cleared_chats", JSON.stringify(clearedChatIds));
  }, [clearedChatIds]);

  const clearClearedFlag = useCallback(() => {
    skipNextLoadRef.current = true;
    setClearedChatIds((prev) => {
      const next = prev.filter((id) => id !== conversationId);
      if (typeof window !== "undefined") {
        window.localStorage.setItem("signal_clone_cleared_chats", JSON.stringify(next));
        window.dispatchEvent(new Event("signal_clone_cleared_chats_changed"));
      }
      return next;
    });
  }, [conversationId]);

  const loadMessages = useCallback(async () => {
    if (skipNextLoadRef.current) {
      skipNextLoadRef.current = false;
      setLoading(false);
      return;
    }
    if (clearedChatIds.includes(conversationId)) {
      setMessages([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [msgs, conv] = await Promise.all([
        api.getMessages(conversationId),
        api.getConversation(conversationId),
      ]);
      const nextConversation = { ...conv, unread_count: 0 };
      setMessages(msgs);
      setConversation(nextConversation);
      upsertConversation(nextConversation);
      if (preferences.readReceipts !== false) {
        await api.markRead(conversationId).catch(() => {});
      }
    } finally {
      setLoading(false);
    }
  }, [clearedChatIds, conversationId, upsertConversation, preferences.readReceipts]);

  useEffect(() => { loadMessages(); }, [conversationId, loadMessages]);

  // Auto-scroll
  useEffect(() => {
    if (isNearBottomRef.current) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [messages, typingUsers]);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    isNearBottomRef.current = nearBottom;
    setShowScrollBtn(!nearBottom);
  }

  function scrollToBottom() {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }

  // WebSocket events
  useEffect(() => {
    const unsub = subscribe((evt: WsEvent) => {
      if (evt.type === "new_message" && evt.message.conversation_id === conversationId) {
        setMessages((prev) => {
          if (evt.message.client_temp_id) {
            const idx = prev.findIndex((m) => m.id === evt.message.client_temp_id);
            if (idx !== -1) {
              const next = [...prev];
              next[idx] = { ...evt.message, reactions: evt.message.reactions ?? {} };
              return next;
            }
          }
          if (prev.some((m) => m.id === evt.message.id)) return prev;
          return [...prev, { ...evt.message, reactions: evt.message.reactions ?? {} }];
        });
        if (evt.message.sender_id !== user?.id && preferences.readReceipts !== false) {
          api.markRead(conversationId).catch(() => {});
        }
      } else if (evt.type === "typing" && evt.conversation_id === conversationId) {
        setTypingUsers((prev) => {
          const next = new Set(prev);
          if (evt.is_typing) next.add(evt.user_id);
          else next.delete(evt.user_id);
          return next;
        });
      } else if (evt.type === "read_receipt" && evt.conversation_id === conversationId) {
        setMessages((prev) =>
          prev.map((m) => (evt.message_ids.includes(m.id) ? { ...m, status: "read" } : m))
        );
      } else if (evt.type === "delivery_update" && evt.conversation_id === conversationId) {
        setMessages((prev) =>
          prev.map((m) => (evt.message_ids.includes(m.id) ? { ...m, status: evt.status } : m))
        );
      } else if (evt.type === "message_edited" && evt.message.conversation_id === conversationId) {
        setMessages((prev) =>
          prev.map((m) => (m.id === evt.message.id ? { ...m, ...evt.message } : m))
        );
      } else if (evt.type === "message_deleted" && evt.conversation_id === conversationId) {
        if (evt.for_everyone) {
          setMessages((prev) =>
            prev.map((m) => m.id === evt.message_id ? { ...m, is_deleted: true, content: "" } : m)
          );
        } else {
          // Delete for me — remove from local list
          setMessages((prev) => prev.filter((m) => m.id !== evt.message_id));
        }
      } else if (evt.type === "reaction_update" && evt.conversation_id === conversationId) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === evt.message_id ? { ...m, reactions: evt.reactions } : m
          )
        );
      }
    });
    return unsub;
  }, [subscribe, conversationId, user?.id, preferences.readReceipts]);

  // Draft change + typing
  function handleDraftChange(value: string) {
    setDraft(value);
    if (!wasTypingRef.current) {
      sendTyping(conversationId, true);
      wasTypingRef.current = true;
    }
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      sendTyping(conversationId, false);
      wasTypingRef.current = false;
    }, 1500);
  }

  // Send
  async function handleSend(e: React.FormEvent | null = null) {
    if (e) e.preventDefault();
    const content = draft.trim();
    if (!content || !user) return;
    const wasCleared = clearedChatIds.includes(conversationId);
    if (wasCleared) await api.clearConversation(conversationId).catch(() => {});

    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const optimistic: Message = {
      id: tempId,
      conversation_id: conversationId,
      sender_id: user.id,
      content,
      status: "sending",
      reply_to_id: replyTo?.id ?? null,
      created_at: new Date().toISOString(),
      reactions: {},
    };
    clearClearedFlag();
    setMessages((prev) => {
      if (wasCleared) return [optimistic];
      return [...prev, optimistic];
    });
    sendMessage(conversationId, content, replyTo?.id ?? undefined, tempId);
    setDraft("");
    setReplyTo(null);
    setShowEmojiPicker(false);
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    sendTyping(conversationId, false);
    wasTypingRef.current = false;
    isNearBottomRef.current = true;
  }

  // Edit save
  async function handleEditSave() {
    if (!editingMsg) return;
    const content = editDraft.trim();
    if (!content) return;
    try {
      const updated = await api.editMessage(conversationId, editingMsg.id, content);
      setMessages((prev) => prev.map((m) => (m.id === editingMsg.id ? { ...m, ...updated } : m)));
    } catch { /* handled by WS broadcast */ }
    setEditingMsg(null);
    setEditDraft("");
  }

  // Delete
  async function handleDeleteForMe(msg: Message) {
    try {
      await api.deleteMessage(conversationId, msg.id, false);
      setMessages((prev) => prev.filter((m) => m.id !== msg.id));
      await refresh();
    } catch { /* ignore */ }
  }

  async function handleDeleteForEveryone(msg: Message) {
    try {
      await api.deleteMessage(conversationId, msg.id, true);
      setMessages((prev) => prev.map((item) => item.id === msg.id ? { ...item, is_deleted: true, content: "" } : item));
      await refresh();
    } catch { /* WS will handle */ }
  }

  // React
  async function handleReact(msg: Message, emoji: string) {
    try {
      const res = await api.reactToMessage(conversationId, msg.id, emoji);
      setMessages((prev) =>
        prev.map((m) => (m.id === msg.id ? { ...m, reactions: res.reactions } : m))
      );
    } catch { /* ignore */ }
  }

  async function handlePin(msg: Message) {
    try {
      const result = await api.togglePin(conversationId, msg.id);
      setMessages((prev) => prev.map((item) => item.id === msg.id ? { ...item, is_pinned: result.pinned } : item));
    } catch {
      // ignore pin errors in UI for now
    }
  }

  // Search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const handle = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await api.getMessages(conversationId, undefined, searchQuery.trim());
        setSearchResults(results);
        setSearchResultIdx(0);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(handle);
  }, [searchQuery, conversationId]);

  function scrollToMessage(msgId: string) {
    const el = msgRefs.current[msgId];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("bg-[#00c8d0]/10");
      setTimeout(() => el.classList.remove("bg-[#00c8d0]/10"), 1500);
    }
  }

  function scrollToPinnedMessage(msgId: string) {
    setTimeout(() => scrollToMessage(msgId), 0);
  }

  function insertEmoji(emoji: string) {
    setDraft((prev) => `${prev}${emoji}`);
    setShowEmojiPicker(false);
    requestAnimationFrame(() => {
      const textarea = document.getElementById("message-composer");
      if (textarea) (textarea as HTMLTextAreaElement).focus();
    });
  }

  function sendGif(url: string) {
    if (!user || isBlocked) return;
    // Event handlers may generate stable optimistic IDs at interaction time.
    // eslint-disable-next-line react-hooks/purity
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const optimistic: Message = {
      id: tempId,
      conversation_id: conversationId,
      sender_id: user.id,
      content: url,
      status: "sending",
      reply_to_id: replyTo?.id ?? null,
      created_at: new Date().toISOString(),
      reactions: {},
    };
    setMessages((prev) => [...prev, optimistic]);
    sendMessage(conversationId, url, replyTo?.id ?? undefined, tempId);
    setShowGifPicker(false);
    setReplyTo(null);
    isNearBottomRef.current = true;
  }

  useEffect(() => {
    if (!showGifPicker) return;
    const apiKey = process.env.NEXT_PUBLIC_GIPHY_API_KEY;
    if (!apiKey) {
      setGifResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      const endpoint = gifQuery.trim()
        ? `https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${encodeURIComponent(gifQuery.trim())}&limit=24&rating=pg-13`
        : `https://api.giphy.com/v1/gifs/trending?api_key=${apiKey}&limit=24&rating=pg-13`;
      try {
        const response = await fetch(endpoint);
        const payload = await response.json() as { data?: Array<{ images?: { fixed_width?: { url?: string } } }> };
        setGifResults(payload.data?.map((gif) => gif.images?.fixed_width?.url).filter((url): url is string => Boolean(url)) || []);
      } catch {
        setGifResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [gifQuery, showGifPicker]);

  async function handleFileUpload(file: File) {
    if (!file) return;
    try {
      const wasCleared = clearedChatIds.includes(conversationId);
      if (wasCleared) await api.clearConversation(conversationId).catch(() => {});
      const uploaded = await api.uploadFile(file);
      const content = uploaded.url;
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const optimistic: Message = {
        id: tempId,
        conversation_id: conversationId,
        sender_id: user!.id,
        content,
        status: "sending",
        reply_to_id: replyTo?.id ?? null,
        created_at: new Date().toISOString(),
        reactions: {},
      };
      clearClearedFlag();
      setMessages((prev) => {
        if (wasCleared) return [optimistic];
        return [...prev, optimistic];
      });
      sendMessage(conversationId, content, replyTo?.id ?? undefined, tempId);
      setReplyTo(null);
      setShowEmojiPicker(false);
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
      sendTyping(conversationId, false);
      wasTypingRef.current = false;
      isNearBottomRef.current = true;
    } catch {
      // ignore upload errors in UI for now
    }
  }

  if (!conversation) {
    return (
      <div className="flex h-full flex-1 items-center justify-center text-gray-400 bg-[#0f1621]">
        {loading ? "Loading chat…" : "Conversation not found"}
      </div>
    );
  }

  const isGroup = conversation.type === "group";
  const other = !isGroup ? conversation.participants.find((p) => p.user.id !== user?.id)?.user : null;
  const currentContact = !isGroup ? other : null;
  const isBlocked = !!currentContact && blockedIds.includes(currentContact.id);
  const isFavorite = !!currentContact && favoriteIds.includes(currentContact.id);

  function toggleFavorite() {
    if (!currentContact) return;
    setFavoriteIds((prev) => {
      const next = prev.includes(currentContact.id)
        ? prev.filter((id) => id !== currentContact.id)
        : [...prev, currentContact.id];
      window.localStorage.setItem("signal_clone_favorites", JSON.stringify(next));
      window.dispatchEvent(new Event("signal_clone_favorites_changed"));
      return next;
    });
  }

  function toggleBlock() {
    if (!currentContact) return;
    setBlockedIds((prev) =>
      prev.includes(currentContact.id)
        ? prev.filter((id) => id !== currentContact.id)
        : [...prev, currentContact.id]
    );
  }

  async function clearCurrentChat() {
    if (!conversation) return;
    setMessages([]);
    const clearedConversation: Conversation = {
      ...conversation,
      last_message: null,
      last_message_at: new Date().toISOString(),
      unread_count: 0,
    };
    setConversation(clearedConversation);
    upsertConversation(clearedConversation);
    setClearedChatIds((prev) => {
      const next = prev.includes(conversationId) ? prev : [...prev, conversationId];
      if (typeof window !== "undefined") {
        window.localStorage.setItem("signal_clone_cleared_chats", JSON.stringify(next));
        window.dispatchEvent(new Event("signal_clone_cleared_chats_changed"));
      }
      return next;
    });
    await api.clearConversation(conversationId).catch(() => {});
    setShowProfileModal(false);
  }

  const typingNames = Array.from(typingUsers)
    .map((uid) => conversation.participants.find((p) => p.user.id === uid)?.user.display_name)
    .filter(Boolean);
  const typingText = typingNames.length > 0
    ? typingNames.length === 1 ? `${typingNames[0]} is typing…` : `${typingNames.join(", ")} are typing…`
    : null;

  const showPresence = preferences.onlineStatus !== false;
  const headerStatus = isGroup
    ? `${conversation.participants.length} members`
    : showPresence
      ? other?.is_online
        ? "Online"
        : other?.last_seen
          ? formatLastSeen(other.last_seen)
          : "Offline"
      : null;
  const shouldShowHeaderMeta = Boolean(typingText || headerStatus);
  const pinnedMessages = messages.filter((message) => message.is_pinned);

  return (
    <div className="flex h-full flex-1 flex-col bg-[#0f1621] relative">
      {/* ── Header ── */}
      <div className="flex h-[64px] shrink-0 items-center gap-3 border-b border-[#252c44] bg-[#141828] px-4 shadow-sm">
        <button
          className="text-gray-400 hover:text-white transition md:hidden cursor-pointer"
          onClick={() => router.push("/chat")}
        >
          ←
        </button>

        <button
          onClick={isGroup ? () => setShowGroupInfo(true) : () => setShowProfileModal(true)}
          className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
        >
          <Avatar
            name={isGroup ? (conversation.name ?? "Group") : (other?.display_name ?? "?")}
            src={isGroup ? conversation.avatar_url : other?.avatar_url}
            size={40}
            online={!isGroup && other?.is_online}
            showOnlineDot={!isGroup && showPresence}
          />
          <div className="min-w-0 flex-1 text-left">
            <p className="truncate font-bold text-gray-100 text-sm">
              {isGroup ? conversation.name : other?.display_name}
            </p>
            {shouldShowHeaderMeta && (
              <p className={`text-xs truncate ${
                !isGroup && showPresence && other?.is_online ? "text-[#00c8d0] font-semibold" : "text-[#8892b0]"
              }`}>
                {typingText || headerStatus}
              </p>
            )}
          </div>
        </button>

        {/* Header actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Search toggle */}
          <button
            type="button"
            onClick={() => { setSearchOpen((p) => !p); setSearchQuery(""); setSearchResults([]); }}
            className={`flex h-8 w-8 items-center justify-center rounded-full transition cursor-pointer ${
              searchOpen ? "bg-[#00c8d0]/20 text-[#00c8d0]" : "text-gray-400 hover:text-white hover:bg-[#1e2236]"
            }`}
            title="Search messages"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </button>

          {/* WebSocket connected indicator */}
          <div
            title={connected ? "Connected" : "Disconnected"}
            className={`h-2 w-2 rounded-full transition-colors ${connected ? "bg-[#00c8d0]" : "bg-gray-500"}`}
          />
        </div>
      </div>

      {pinnedMessages.length > 0 && (
        <div className="shrink-0 border-b border-[#252c44] bg-[#181d30] px-4 py-2">
          <div className="flex items-center gap-2 overflow-x-auto">
            <span className="shrink-0 text-sm" title="Pinned messages">📌</span>
            {pinnedMessages.map((message) => {
              const preview = message.content.startsWith("http") || message.content.startsWith("/api/upload/")
                ? "Attachment"
                : message.content;
              return (
                <button
                  key={message.id}
                  type="button"
                  onClick={() => scrollToPinnedMessage(message.id)}
                  className="max-w-[230px] shrink-0 rounded-lg border border-[#00c8d0]/25 bg-[#1e2236] px-2.5 py-1.5 text-left hover:border-[#00c8d0]/60 hover:bg-[#222840] transition"
                  title="Jump to pinned message"
                >
                  <span className="block truncate text-xs font-semibold text-gray-200">{preview}</span>
                  <span className="block text-[10px] text-[#8892b0]">Pinned message</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Search bar ── */}
      {searchOpen && (
        <div className="flex items-center gap-2 border-b border-[#252c44] bg-[#181d30] px-4 py-2 shrink-0">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8892b0" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            autoFocus
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search messages…"
            className="flex-1 bg-transparent text-sm text-gray-100 placeholder-[#8892b0] outline-none"
          />
          {searching && <span className="text-xs text-[#8892b0]">Searching…</span>}
          {searchResults.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-[#8892b0]">
              <span>{searchResultIdx + 1}/{searchResults.length}</span>
              <button
                type="button"
                onClick={() => {
                  const idx = Math.max(0, searchResultIdx - 1);
                  setSearchResultIdx(idx);
                  scrollToMessage(searchResults[idx].id);
                }}
                className="px-1.5 py-0.5 rounded hover:bg-[#252c44] cursor-pointer"
              >↑</button>
              <button
                type="button"
                onClick={() => {
                  const idx = Math.min(searchResults.length - 1, searchResultIdx + 1);
                  setSearchResultIdx(idx);
                  scrollToMessage(searchResults[idx].id);
                }}
                className="px-1.5 py-0.5 rounded hover:bg-[#252c44] cursor-pointer"
              >↓</button>
            </div>
          )}
          {searchQuery && !searching && searchResults.length === 0 && (
            <span className="text-xs text-[#8892b0]">No results</span>
          )}
          <button
            type="button"
            onClick={() => { setSearchOpen(false); setSearchQuery(""); setSearchResults([]); }}
            className="text-gray-400 hover:text-white cursor-pointer ml-1"
          >✕</button>
        </div>
      )}

      {/* ── Messages ── */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="chat-messages-surface flex-1 overflow-y-auto px-2 py-4"
        style={{
          background: "linear-gradient(180deg, #0d1117 0%, #0f1621 100%)",
          backgroundAttachment: "local",
        }}
      >
        {loading && (
          <div className="space-y-3 px-2 py-8" aria-label="Loading messages">
            {["w-2/5", "ml-auto w-1/3", "w-1/2"].map((width, index) => (
              <div key={index} className={`flex ${index === 1 ? "justify-end" : "justify-start"}`}>
                <div className={`h-12 ${width} animate-pulse rounded-2xl bg-[#1e2a38]`} />
              </div>
            ))}
          </div>
        )}

        {!loading && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-10">
            <div className="rounded-full bg-[#1e2236] p-4 border border-[#252c44]">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#00c8d0" strokeWidth="1.5">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            </div>
            <p className="text-[#8892b0] text-sm font-medium">No messages yet</p>
            <p className="text-[#4a5580] text-xs">Say hello! 👋</p>
          </div>
        )}

        {messages.map((msg, i) => {
          const prevMsg = messages[i - 1];
          const showDate = !prevMsg || !isSameDay(prevMsg.created_at, msg.created_at);
          const isOwn = msg.sender_id === user?.id;
          const sender = conversation.participants.find((p) => p.user.id === msg.sender_id)?.user;
          const senderName = sender?.display_name ?? "Unknown";
          const replyMsg = msg.reply_to_id ? messages.find((m) => m.id === msg.reply_to_id) : null;
          const replySender = replyMsg
            ? conversation.participants.find((p) => p.user.id === replyMsg.sender_id)?.user?.display_name
            : undefined;

          // Highlight matching search result
          const isSearchMatch = searchResults.some((r) => r.id === msg.id);

          return (
            <div
              key={msg.id}
              ref={(el) => { msgRefs.current[msg.id] = el; }}
              className={`transition-colors duration-700 rounded-xl ${isSearchMatch ? "bg-[#00c8d0]/10" : ""}`}
            >
              {showDate && (
                <div className="flex justify-center my-4">
                  <span className="rounded-full bg-[#1e2236] border border-[#252c44] px-3 py-1 text-[11px] font-semibold text-[#8892b0]">
                    {formatDateSeparator(msg.created_at)}
                  </span>
                </div>
              )}
              <MessageBubble
                message={msg}
                isOwn={isOwn}
                senderName={senderName}
                showSenderName={isGroup}
                currentUserId={user?.id ?? ""}
                replyToMessage={
                  replyMsg
                    ? { content: replyMsg.content, senderName: replySender }
                    : null
                }
                onReply={() => { setReplyTo(msg); setEditingMsg(null); }}
                onEdit={isOwn ? (m) => { setEditingMsg(m); setEditDraft(m.content); setReplyTo(null); } : undefined}
                onDeleteForMe={(m) => handleDeleteForMe(m)}
                onDeleteForEveryone={isOwn ? (m) => handleDeleteForEveryone(m) : undefined}
                onPin={(m) => handlePin(m)}
                onReact={(m, emoji) => handleReact(m, emoji)}
              />
            </div>
          );
        })}

        {/* Typing indicator */}
        {typingText && (
          <div className="flex items-center gap-2 px-4 py-1 mt-1">
            <div className="flex gap-1 items-center rounded-full bg-[#1e2a38] px-3 py-2">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-1.5 w-1.5 rounded-full bg-[#00c8d0] animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
            <span className="text-xs text-[#8892b0]">{typingText}</span>
          </div>
        )}
      </div>

      {/* Scroll to bottom button */}
      {showScrollBtn && (
        <button
          type="button"
          onClick={scrollToBottom}
          className="absolute bottom-24 right-5 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-[#00c8d0] text-[#0d1117] shadow-lg hover:bg-[#00b0b8] transition cursor-pointer"
        >
          ↓
        </button>
      )}

      {/* ── Edit bar ── */}
      {editingMsg && (
        <div className="flex items-center gap-2 border-t border-[#252c44] bg-[#181d30] px-4 py-2 shrink-0">
          <span className="text-[#00c8d0] text-xs font-bold">✏️ Editing</span>
          <span className="flex-1 truncate text-xs text-[#8892b0]">{editingMsg.content}</span>
          <button
            type="button"
            onClick={() => { setEditingMsg(null); setEditDraft(""); }}
            className="text-gray-400 hover:text-white text-sm cursor-pointer"
          >✕</button>
        </div>
      )}

      {/* ── Reply bar ── */}
      {replyTo && !editingMsg && (
        <div className="flex items-center gap-2 border-t border-[#252c44] bg-[#181d30] px-4 py-2 shrink-0">
          <div className="h-8 w-1 rounded-full bg-[#00c8d0]" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold text-[#00c8d0]">
              ↩ Replying to {conversation.participants.find((p) => p.user.id === replyTo.sender_id)?.user.display_name ?? ""}
            </p>
            <p className="truncate text-xs text-[#8892b0]">{replyTo.content}</p>
          </div>
          <button
            type="button"
            onClick={() => setReplyTo(null)}
            className="text-gray-400 hover:text-white text-sm cursor-pointer"
          >✕</button>
        </div>
      )}

      {/* ── Emoji picker ── */}
      {showEmojiPicker && (
        <div className="absolute bottom-20 left-4 z-20 overflow-hidden rounded-2xl border border-[#252c44] shadow-2xl">
          <EmojiPicker
            onEmojiClick={(emojiData) => insertEmoji(emojiData.emoji)}
            width={300}
            height={360}
            theme={Theme.DARK}
            lazyLoadEmojis
          />
        </div>
      )}

      {showGifPicker && (
        <div className="absolute bottom-20 left-16 z-20 w-80 rounded-2xl border border-[#252c44] bg-[#181d30] p-3 shadow-2xl">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-widest text-[#8892b0]">GIFs</span>
            <button type="button" onClick={() => { setShowGifPicker(false); setGifQuery(""); }} className="text-xs text-[#8892b0] hover:text-white">Close</button>
          </div>
          <input value={gifQuery} onChange={(e) => setGifQuery(e.target.value)} placeholder="Search all GIFs" className="mb-2 w-full rounded-lg border border-[#252c44] bg-[#0d1117] px-3 py-2 text-xs text-gray-100 outline-none placeholder-[#8892b0] focus:border-[#00c8d0]" />
          {gifResults.length > 0 ? (
            <div className="grid max-h-64 grid-cols-2 gap-2 overflow-y-auto">
            {gifResults.map((url) => (
              <button key={url} type="button" onClick={() => sendGif(url)} className="overflow-hidden rounded-lg border border-[#252c44] bg-[#0d1117] hover:border-[#00c8d0] cursor-pointer">
                <img src={url} alt="GIF" className="h-24 w-full object-cover" />
              </button>
            ))}
            </div>
          ) : (
            <p className="mb-2 text-center text-xs text-[#8892b0]">
              {process.env.NEXT_PUBLIC_GIPHY_API_KEY ? "No GIFs found" : "Add NEXT_PUBLIC_GIPHY_API_KEY for GIF search"}
            </p>
          )}
          <div className="flex gap-2 border-t border-[#252c44] pt-2">
            <input value={gifUrl} onChange={(e) => setGifUrl(e.target.value)} placeholder="Paste GIF URL" className="min-w-0 flex-1 rounded-lg border border-[#252c44] bg-[#0d1117] px-2 py-1.5 text-[11px] text-gray-100 outline-none placeholder-[#8892b0]" />
            <button type="button" disabled={!/^https?:\/\/.*\.gif(?:[?#].*)?$/i.test(gifUrl.trim())} onClick={() => { sendGif(gifUrl.trim()); setGifUrl(""); }} className="rounded-lg bg-[#00c8d0] px-2.5 text-[11px] font-bold text-[#0d1117] disabled:opacity-40">Send</button>
          </div>
        </div>
      )}

      {/* ── Composer ── */}
      <form
        onSubmit={editingMsg ? (e) => { e.preventDefault(); handleEditSave(); } : handleSend}
        className="flex items-end gap-2 border-t border-[#252c44] bg-[#141828] px-4 py-3 shrink-0"
      >
        <label className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-400 hover:text-white hover:bg-[#1e2236] transition cursor-pointer">
          <input
            type="file"
            accept="application/pdf,image/*,.gif"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileUpload(file);
              e.currentTarget.value = "";
            }}
          />
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/>
            <path d="M14 2v6h6"/>
            <path d="M12 18v-8"/>
            <path d="M9 15l3-3 3 3"/>
          </svg>
        </label>

        {/* Emoji button */}
        <button
          type="button"
          onClick={() => { setShowEmojiPicker((p) => !p); setShowGifPicker(false); }}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition cursor-pointer ${
            showEmojiPicker ? "bg-[#00c8d0]/20 text-[#00c8d0]" : "text-gray-400 hover:text-white hover:bg-[#1e2236]"
          }`}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <circle cx="12" cy="12" r="10"/>
            <path d="M8 13s1.5 2 4 2 4-2 4-2"/>
            <line x1="9" y1="9" x2="9.01" y2="9"/>
            <line x1="15" y1="9" x2="15.01" y2="9"/>
          </svg>
        </button>

        <button
          type="button"
          onClick={() => { setShowGifPicker((p) => !p); setShowEmojiPicker(false); }}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[10px] font-black transition cursor-pointer ${
            showGifPicker ? "bg-[#00c8d0]/20 text-[#00c8d0]" : "text-gray-400 hover:bg-[#1e2236] hover:text-white"
          }`}
          title="Send GIF"
        >
          GIF
        </button>

        {/* Text area */}
        <textarea
          id="message-composer"
          rows={1}
          value={editingMsg ? editDraft : draft}
          disabled={isBlocked}
          onChange={(e) => {
            if (editingMsg) setEditDraft(e.target.value);
            else handleDraftChange(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (editingMsg) handleEditSave();
              else handleSend();
            }
            if (e.key === "Escape") {
              setEditingMsg(null);
              setEditDraft("");
              setReplyTo(null);
            }
          }}
          placeholder={
            isBlocked
              ? "You blocked this user"
              : editingMsg
                ? "Edit message…"
                : "Message…"
          }
          className="flex-1 resize-none rounded-xl bg-[#1e2236] border border-[#252c44] px-4 py-2.5 text-sm text-gray-100 placeholder-[#8892b0] outline-none focus:border-[#00c8d0] transition max-h-32 leading-relaxed disabled:cursor-not-allowed disabled:opacity-60"
          style={{ minHeight: 40 }}
        />

        {/* Send / Save button */}
        <button
          type="submit"
          disabled={isBlocked || !(editingMsg ? editDraft.trim() : draft.trim())}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#00c8d0] text-[#0d1117] transition hover:bg-[#00b0b8] hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-lg"
        >
          {editingMsg ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          )}
        </button>
      </form>

      {/* Group info modal */}
      {showGroupInfo && conversation.type === "group" && (
        <GroupInfoModal
          conversation={conversation}
          onClose={() => setShowGroupInfo(false)}
          onUpdated={(c) => { setConversation(c); upsertConversation(c); }}
        />
      )}

      {!isGroup && showProfileModal && currentContact && (
        <UserProfileModal
          user={currentContact}
          isFavorite={isFavorite}
          isBlocked={isBlocked}
          onClose={() => setShowProfileModal(false)}
          onToggleFavorite={toggleFavorite}
          onToggleBlock={toggleBlock}
          onClearChat={clearCurrentChat}
        />
      )}
    </div>
  );
}
