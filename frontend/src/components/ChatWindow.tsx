"use client";

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

function isSameDay(a: string, b: string) {
  const da = new Date(a);
  const db = new Date(b);
  return da.toDateString() === db.toDateString();
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

const QUICK_EMOJIS = [
  "😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "😊", "😇", "🙂", "🙃",
  "👍", "👎", "👌", "👏", "🙌", "🫶", "💪", "🔥", "✨", "🎉", "✅", "❤️",
  "💙", "💚", "💛", "💜", "🩷", "😮", "😲", "😱", "😢", "😭", "😡", "😎",
  "🤔", "🤝", "🙏", "🎂", "🍕", "☕", "🌚", "🌞", "🚀", "💯", "⚽", "🎵"
];

export default function ChatWindow({ conversationId }: { conversationId: string }) {
  const { user } = useAuth();
  const { sendMessage, sendTyping, subscribe, connected } = useWs();
  const { conversations, setActiveConversationId, upsertConversation } = useConversations();
  const router = useRouter();

  const [conversation, setConversation] = useState<Conversation | null>(
    conversations.find((c) => c.id === conversationId) || null
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasTypingRef = useRef(false);
  const isNearBottomRef = useRef(true);

  // Check stored preferences
  const preferences = typeof window !== "undefined" && window.localStorage.getItem("signal_clone_preferences")
    ? JSON.parse(window.localStorage.getItem("signal_clone_preferences") || "{}")
    : { onlineStatus: true, readReceipts: true, notifications: true };

  useEffect(() => {
    const c = conversations.find((c) => c.id === conversationId);
    if (c) setConversation(c);
  }, [conversations, conversationId]);

  useEffect(() => {
    setActiveConversationId(conversationId);
    return () => setActiveConversationId(null);
  }, [conversationId, setActiveConversationId]);

  const loadMessages = useCallback(async () => {
    setLoading(true);
    try {
      const [msgs, conv] = await Promise.all([
        api.getMessages(conversationId),
        api.getConversation(conversationId),
      ]);
      setMessages(msgs);
      setConversation(conv);
      upsertConversation(conv);
      if (preferences.readReceipts !== false) {
        await api.markRead(conversationId);
      }
    } finally {
      setLoading(false);
    }
  }, [conversationId, upsertConversation, preferences.readReceipts]);

  useEffect(() => {
    loadMessages();
  }, [conversationId, loadMessages]);

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

  useEffect(() => {
    const unsub = subscribe((evt: WsEvent) => {
      if (evt.type === "new_message" && evt.message.conversation_id === conversationId) {
        setMessages((prev) => {
          if (evt.message.client_temp_id) {
            const idx = prev.findIndex((m) => m.id === evt.message.client_temp_id);
            if (idx !== -1) {
              const next = [...prev];
              next[idx] = evt.message;
              return next;
            }
          }
          if (prev.some((m) => m.id === evt.message.id)) return prev;
          return [...prev, evt.message];
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
      }
    });
    return unsub;
  }, [subscribe, conversationId, user?.id, preferences.readReceipts]);

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

  function handleSend(e: React.FormEvent | null = null) {
    if (e) e.preventDefault();
    const content = draft.trim();
    if (!content || !user) return;

    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const replyTargetId = replyTo?.id ?? null;
    const optimistic: Message = {
      id: tempId,
      conversation_id: conversationId,
      sender_id: user.id,
      content,
      status: "sending",
      reply_to_id: replyTargetId,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    sendMessage(conversationId, content, replyTargetId ?? undefined, tempId);
    setDraft("");
    setReplyTo(null);
    setShowEmojiPicker(false);
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    sendTyping(conversationId, false);
    wasTypingRef.current = false;
    isNearBottomRef.current = true;
  }

  function insertEmoji(emoji: string) {
    setDraft((prev) => `${prev}${emoji}`);
    setShowEmojiPicker(false);
    requestAnimationFrame(() => {
      const textarea = document.getElementById("message-composer");
      if (textarea) textarea.focus();
    });
  }

  if (!conversation) {
    return (
      <div className="flex h-full flex-1 items-center justify-center text-[var(--muted)] bg-[var(--chat-bg)]">
        {loading ? "Loading chat..." : "Conversation not found"}
      </div>
    );
  }

  const isGroup = conversation.type === "group";
  const other = !isGroup ? conversation.participants.find((p) => p.user.id !== user?.id)?.user : null;
  const typingNames = Array.from(typingUsers)
    .map((uid) => conversation.participants.find((p) => p.user.id === uid)?.user.display_name)
    .filter(Boolean);

  const typingText = typingNames.length > 0
    ? typingNames.length === 1
      ? `${typingNames[0]} is typing...`
      : `${typingNames.join(", ")} are typing...`
    : null;

  const showOnline = preferences.onlineStatus !== false;
  const statusLine = typingText
    ? typingText
    : isGroup
    ? `${conversation.participants.length} members`
    : showOnline && other?.is_online
    ? "online"
    : showOnline
    ? formatLastSeen(other?.last_seen ?? null)
    : "";

  return (
    <div className="flex h-full flex-1 flex-col bg-[var(--chat-bg)]">
      {!connected && (
        <div className="flex items-center justify-center gap-2 bg-amber-500 px-4 py-1.5 text-xs font-semibold text-white shadow-xs">
          Reconnecting to Signal server...
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--border-color)] bg-[var(--panel-bg)] px-4 py-3 shadow-xs">
        <div className="flex items-center gap-3 min-w-0">
          <button className="text-[var(--muted)] hover:text-[var(--foreground)] md:hidden" onClick={() => router.push("/chat")}>
            ←
          </button>
          <button
            className="flex items-center gap-3 text-left min-w-0"
            onClick={() => isGroup && setShowGroupInfo(true)}
          >
            <Avatar
              name={conversation.name || "Group"}
              src={conversation.avatar_url}
              size={42}
              showOnlineDot={!isGroup && showOnline}
              online={other?.is_online}
            />
            <div className="min-w-0">
              <p className="truncate text-base font-bold text-[var(--foreground)] leading-snug">{conversation.name}</p>
              <p className={`truncate text-xs ${typingText ? "text-[#2c6bed] font-semibold" : "text-[var(--muted)] font-medium"}`}>
                {statusLine}
              </p>
            </div>
          </button>
        </div>


      </div>

      {/* Message Area */}
      <div ref={scrollRef} onScroll={handleScroll} className="relative flex-1 space-y-1.5 overflow-y-auto px-4 py-5 bg-[var(--chat-bg)]">
        {loading && <p className="text-center text-sm text-[var(--muted)] py-4">Loading messages...</p>}
        {!loading && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center my-14 text-center text-[var(--muted)]">
            <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--border-color)] bg-[var(--panel-bg)] text-2xl shadow-sm">💬</div>
            <p className="text-sm font-semibold text-[var(--foreground)]">No messages yet</p>
            <p className="mt-1 text-xs text-[var(--muted)]">Send a message to start conversation</p>
          </div>
        )}
        {messages.map((m, i) => {
          const senderName = conversation.participants.find((p) => p.user.id === m.sender_id)?.user.display_name;
          const prevSender = i > 0 ? messages[i - 1].sender_id : null;
          const showDate = i === 0 || !isSameDay(messages[i - 1].created_at, m.created_at);
          const replyTarget = m.reply_to_id ? messages.find((msg) => msg.id === m.reply_to_id) : null;
          const replyTargetName = replyTarget ? conversation.participants.find((p) => p.user.id === replyTarget.sender_id)?.user.display_name : undefined;
          return (
            <div key={m.id}>
              {showDate && (
                <div className="my-3.5 flex justify-center">
                  <span className="rounded-full border border-[var(--border-color)] bg-[var(--panel-bg)] px-3.5 py-1 text-[11px] font-semibold text-[var(--muted)] shadow-xs">
                    {formatDateSeparator(m.created_at)}
                  </span>
                </div>
              )}
              <MessageBubble
                message={m}
                isOwn={m.sender_id === user?.id}
                senderName={senderName}
                showSenderName={isGroup && m.sender_id !== prevSender}
                replyToMessage={replyTarget ? { senderName: replyTargetName, content: replyTarget.content } : null}
                onReply={() => setReplyTo(m)}
              />
            </div>
          );
        })}
      </div>

      {showScrollBtn && (
        <div className="absolute bottom-20 right-6 z-10">
          <button
            onClick={scrollToBottom}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border-color)] bg-[var(--panel-bg)] text-[var(--foreground)] shadow-md transition hover:bg-[var(--panel-alt)] font-bold"
          >
            ↓
          </button>
        </div>
      )}

      {/* Composer Input Bar */}
      {replyTo && (
        <div className="border-t border-[var(--border-color)] bg-[var(--panel-bg)] px-3 pt-3">
          <div className="flex items-center justify-between gap-2 rounded-xl border border-[#2c6bed]/20 bg-[#eef3ff] px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-wide text-[#2c6bed]">Replying to</p>
              <p className="truncate text-sm text-gray-700">{replyTo.content}</p>
            </div>
            <button type="button" onClick={() => setReplyTo(null)} className="text-sm font-bold text-[#2c6bed] hover:text-[#1d5bd8]">
              ✕
            </button>
          </div>
        </div>
      )}

      <div className="border-t border-[var(--border-color)] bg-[var(--panel-bg)] p-3 shadow-xs">
        {showEmojiPicker && (
          <div className="mb-2 flex flex-wrap gap-2 rounded-2xl border border-[var(--border-color)] bg-[var(--panel-alt)] p-2">
            {QUICK_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => insertEmoji(emoji)}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--panel-bg)] text-lg transition hover:scale-105"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={() => setShowEmojiPicker((prev) => !prev)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[var(--border-color)] bg-[var(--input-bg)] text-lg text-[var(--foreground)] transition hover:bg-[var(--panel-alt)]"
            aria-label="Insert emoji"
          >
            😊
          </button>
          <textarea
            id="message-composer"
            value={draft}
            onChange={(e) => handleDraftChange(e.target.value)}
            onKeyDown={(e) => {
              const modifier = e.ctrlKey || e.metaKey;

              if ((e.key === "Enter" && !e.shiftKey) || (e.key === "Enter" && modifier)) {
                e.preventDefault();
                handleSend();
              }

              if (modifier && e.key.toLowerCase() === "e") {
                e.preventDefault();
                setShowEmojiPicker((prev) => !prev);
              }

              if (modifier && e.key.toLowerCase() === "l") {
                e.preventDefault();
                const el = document.getElementById("message-composer");
                el?.focus();
              }

              if (modifier && e.key.toLowerCase() === "r") {
                e.preventDefault();
                const lastMessage = [...messages].reverse().find((msg) => msg.sender_id !== user?.id);
                if (lastMessage) setReplyTo(lastMessage);
              }

              if (modifier && e.key === "Backspace") {
                e.preventDefault();
                setDraft("");
              }

              if (e.key === "Escape") {
                setShowEmojiPicker(false);
                if (replyTo) setReplyTo(null);
              }
            }}
            placeholder={replyTo ? "Write a reply..." : "Signal message"}
            rows={1}
            className="max-h-32 flex-1 resize-none rounded-2xl border border-[var(--border-color)] bg-[var(--input-bg)] px-4 py-2.5 text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted)] focus:border-[#2c6bed] focus:bg-[var(--panel-bg)] focus:ring-1 focus:ring-[#2c6bed]"
          />
          <button
            type="button"
            onClick={() => handleSend()}
            disabled={!draft.trim()}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#2c6bed] text-white transition hover:bg-[#1d5bd8] shadow-sm disabled:opacity-40"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M3 11l18-8-8 18-2-8-8-2z" stroke="white" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {showGroupInfo && isGroup && (
        <GroupInfoModal
          conversation={conversation}
          onClose={() => setShowGroupInfo(false)}
          onUpdated={(c) => {
            upsertConversation(c);
            setConversation(c);
          }}
        />
      )}
    </div>
  );
}
