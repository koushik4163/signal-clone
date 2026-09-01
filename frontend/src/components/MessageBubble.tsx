"use client";
/* eslint-disable @next/next/no-img-element */

import { useRef, useState, useEffect } from "react";
import type { Message } from "@/lib/types";
import { formatMessageTime } from "@/lib/format";
import { API_URL } from "@/lib/api";

const SENDER_COLORS = [
  "#53bdeb", "#ff85c0", "#ffd666", "#35f1a8",
  "#c084fc", "#38bdf8", "#f87171", "#a3e635",
];

function colorForSender(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return SENDER_COLORS[Math.abs(hash) % SENDER_COLORS.length];
}

function StatusTicks({ status }: { status: Message["status"] }) {
  if (status === "sending") return <span className="text-[11px] opacity-60">⏱</span>;
  const color = status === "read" ? "#00c8d0" : "#4a5580";
  const double = status === "delivered" || status === "read";
  return (
    <svg width="16" height="11" viewBox="0 0 16 11" fill="none" className="shrink-0">
      <path d="M1 5.5L4 8.5L9 2.5" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      {double && <path d="M6 5.5L9 8.5L15 1.5" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  );
}

const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🔥"];

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  senderName?: string;
  showSenderName?: boolean;
  replyToMessage?: { senderName?: string; content: string } | null;
  currentUserId: string;
  onReply?: () => void;
  onEdit?: (msg: Message) => void;
  onDeleteForMe?: (msg: Message) => void;
  onDeleteForEveryone?: (msg: Message) => void;
  onPin?: (msg: Message) => void;
  onReact?: (msg: Message, emoji: string) => void;
}

export default function MessageBubble({
  message,
  isOwn,
  senderName,
  showSenderName,
  replyToMessage,
  currentUserId,
  onReply,
  onEdit,
  onDeleteForMe,
  onDeleteForEveryone,
  onPin,
  onReact,
}: MessageBubbleProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [showReactPicker, setShowReactPicker] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const actionVisible = isHovered || showMenu || showReactPicker;

  // Close menu when clicking outside
  useEffect(() => {
    if (!showMenu && !showReactPicker) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
        setShowReactPicker(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showMenu, showReactPicker]);

  const isDeleted = message.is_deleted;

  // Count reactions
  const reactionEntries = Object.entries(message.reactions || {}).filter(([, users]) => users.length > 0);
  const myReactions = new Set(
    Object.entries(message.reactions || {})
      .filter(([, users]) => users.includes(currentUserId))
      .map(([emoji]) => emoji)
  );
  const normalizedContent = message.content.trim();
  const attachmentUrl = /^(?:https?:\/\/|\/api\/upload\/files\/)/i.test(normalizedContent)
    ? normalizedContent
    : null;
  const resolvedAttachmentUrl = attachmentUrl
    ? attachmentUrl.startsWith("/") ? `${API_URL}${attachmentUrl}` : attachmentUrl
    : "";
  let attachmentPath = normalizedContent;
  try {
    attachmentPath = new URL(resolvedAttachmentUrl, API_URL).pathname;
  } catch {
    // Keep the original content for malformed URLs.
  }
  const isPdfAttachment = /\.pdf$/i.test(attachmentPath);
  const isImageAttachment = !isPdfAttachment && /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(attachmentPath);
  const attachmentLabel = attachmentUrl
    ? decodeURIComponent(attachmentPath.split("/").pop() || "Attachment")
    : "Attachment";

  return (
    <div
      className={`flex ${isOwn ? "justify-end" : "justify-start"} px-2 py-0.5 relative`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className={`relative flex max-w-full items-end gap-2 ${isOwn ? "flex-row-reverse" : ""}`} ref={menuRef}>
        <div
          className={`relative max-w-[calc(100%-52px)] md:max-w-[72%] rounded-2xl px-3.5 py-2.5 shadow-md transition-all select-text ${
            isOwn
              ? "rounded-br-sm bg-[#00535a] text-gray-100"
              : "rounded-bl-sm bg-[#1e2a38] text-gray-100"
          } ${isDeleted ? "opacity-60 italic" : ""}`}
        >
          {showSenderName && !isOwn && senderName && (
            <p className="mb-1 text-xs font-bold" style={{ color: colorForSender(senderName) }}>
              {senderName}
            </p>
          )}

          {replyToMessage && (
            <div className={`mb-2 rounded-xl border-l-4 px-2.5 py-1.5 text-[11px] ${
              isOwn
                ? "border-[#00c8d0] bg-[#003f45] text-teal-100"
                : "border-[#00c8d0] bg-[#141828] text-gray-300"
            }`}>
              <p className="font-semibold truncate">
                {replyToMessage.senderName ? `↩ ${replyToMessage.senderName}` : "↩ Reply"}
              </p>
              <p className="mt-0.5 truncate opacity-90 max-w-[240px]">{replyToMessage.content}</p>
            </div>
          )}

          {isDeleted ? (
            <p className="text-sm text-gray-400 italic">🚫 This message was deleted</p>
          ) : attachmentUrl ? (
            isImageAttachment ? (
              <div className="overflow-hidden rounded-xl border border-[#00c8d0]/25 bg-[#0d1b22]">
                <img
                  src={resolvedAttachmentUrl}
                  alt="Shared attachment"
                  className="max-h-72 w-auto max-w-full object-contain"
                />
                <div className="flex items-center justify-between border-t border-[#00c8d0]/15 px-2.5 py-1.5">
                  <span className="truncate text-[10px] text-[#8892b0]">{attachmentLabel}</span>
                  <a href={resolvedAttachmentUrl} download={isImageAttachment ? "shared.gif" : attachmentLabel} target="_blank" rel="noreferrer" className="text-xs font-bold text-[#00c8d0] hover:text-white">Download</a>
                </div>
              </div>
            ) : (
              <div className="min-w-[260px] overflow-hidden rounded-xl border border-[#00c8d0]/30 bg-[#0d1b22]">
                <div className="flex items-center gap-3 px-3 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-500/15 text-lg">
                  {isPdfAttachment ? "📄" : "📎"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[#d7f9ff]">{attachmentLabel}</p>
                  <p className="text-[10px] uppercase tracking-wide text-[#8892b0]">{isPdfAttachment ? "PDF document" : "File attachment"}</p>
                </div>
                </div>
                <div className="flex border-t border-[#00c8d0]/15">
                  <a href={resolvedAttachmentUrl} target="_blank" rel="noreferrer" className="flex-1 px-3 py-2 text-center text-xs font-bold text-[#00c8d0] hover:bg-[#00c8d0]/10">View</a>
                  <a href={resolvedAttachmentUrl} download={attachmentLabel} target="_blank" rel="noreferrer" className="flex-1 border-l border-[#00c8d0]/15 px-3 py-2 text-center text-xs font-bold text-[#00c8d0] hover:bg-[#00c8d0]/10">Save as</a>
                </div>
              </div>
            )
          ) : (
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message.content}</p>
          )}

          <div className="mt-1 flex items-center justify-end gap-1.5">
            {message.edited_at && !isDeleted && (
              <span className="text-[9px] text-gray-400 italic">edited</span>
            )}
            <span className="message-timestamp text-[10px] font-medium">
              {formatMessageTime(message.created_at)}
            </span>
            {isOwn && <StatusTicks status={message.status} />}
          </div>
        </div>

        {(!isDeleted || onDeleteForMe) && (
          <div className={`relative z-30 flex items-center gap-1.5 transition-opacity duration-150 ${actionVisible ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}>
            {!isDeleted && (
            <button
              type="button"
              onClick={() => { setShowReactPicker((p) => !p); setShowMenu(false); }}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1e2236] border border-[#252c44] text-base hover:bg-[#252c44] hover:scale-110 transition cursor-pointer shadow"
              title="React"
            >
              😊
            </button>
            )}

            {!isDeleted && onReply && (
              <button
                type="button"
                onClick={onReply}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1e2236] border border-[#252c44] text-gray-400 hover:text-white hover:bg-[#252c44] transition cursor-pointer shadow"
                title="Reply"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/>
                </svg>
              </button>
            )}

            <button
              type="button"
              onClick={() => { setShowMenu((p) => !p); setShowReactPicker(false); }}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1e2236] border border-[#252c44] text-gray-400 hover:text-white hover:bg-[#252c44] transition cursor-pointer shadow"
              title="More"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>
              </svg>
            </button>
          </div>
        )}

        {showReactPicker && (
          <div className={`absolute ${isOwn ? "right-full mr-2" : "left-full ml-2"} top-1/2 z-40 flex -translate-y-1/2 items-center gap-1.5 rounded-full bg-[#181d30] border border-[#252c44] px-3 py-2 shadow-xl`}>
            {QUICK_REACTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  onReact?.(message, emoji);
                  setShowReactPicker(false);
                }}
                className={`text-lg hover:scale-125 transition-transform cursor-pointer leading-none ${
                  myReactions.has(emoji) ? "opacity-100" : "opacity-80 hover:opacity-100"
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        {showMenu && (
          <div className="absolute left-0 top-full z-40 mt-2 w-[180px] rounded-xl bg-[#181d30] border border-[#252c44] shadow-2xl overflow-hidden">
            {onReply && (
              <button
                type="button"
                onClick={() => { onReply(); setShowMenu(false); }}
                className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-gray-200 hover:bg-[#1e2236] cursor-pointer border-b border-[#252c44]"
              >
                <span className="text-base">↩</span>
                <span>Reply</span>
              </button>
            )}
            {!isDeleted && isOwn && onEdit && (
              <button
                type="button"
                onClick={() => { onEdit(message); setShowMenu(false); }}
                className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-gray-200 hover:bg-[#1e2236] cursor-pointer border-b border-[#252c44]"
              >
                <span className="text-base">✏️</span>
                <span>Edit</span>
              </button>
            )}
            {onDeleteForMe && (
              <button
                type="button"
                onClick={() => { onDeleteForMe(message); setShowMenu(false); }}
                className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-red-400 hover:bg-[#1e2236] cursor-pointer border-b border-[#252c44]"
              >
                <span className="text-base">🗑️</span>
                <span>Delete for me</span>
              </button>
            )}
            {!isDeleted && onPin && (
              <button type="button" onClick={() => { onPin(message); setShowMenu(false); }} className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-gray-200 hover:bg-[#1e2236] cursor-pointer">
                <span className="text-base">📌</span>
                <span>{message.is_pinned ? "Unpin" : "Pin"}</span>
              </button>
            )}
            {isOwn && onDeleteForEveryone && !isDeleted && (
              <button
                type="button"
                onClick={() => { onDeleteForEveryone(message); setShowMenu(false); }}
                className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-red-400 hover:bg-[#1e2236] cursor-pointer"
              >
                <span className="text-base">🗑️</span>
                <span>Delete for everyone</span>
              </button>
            )}
          </div>
        )}
      </div>

      {reactionEntries.length > 0 && (
        <div className={`flex flex-wrap gap-1 mt-1 ${isOwn ? "justify-end" : "justify-start"}`}>
          {reactionEntries.map(([emoji, users]) => (
            <button
              key={emoji}
              type="button"
              onClick={() => onReact?.(message, emoji)}
              className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold border transition cursor-pointer ${
                myReactions.has(emoji)
                  ? "bg-[#00c8d0]/20 border-[#00c8d0]/50 text-[#00c8d0]"
                  : "bg-[#1e2236] border-[#252c44] text-gray-300 hover:border-[#00c8d0]/40"
              }`}
            >
              <span>{emoji}</span>
              <span>{users.length}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
