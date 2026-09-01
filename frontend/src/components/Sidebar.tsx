"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useConversations } from "@/lib/conversations-context";
import Avatar from "./Avatar";
import { formatConversationTime } from "@/lib/format";
import NewChatModal from "./NewChatModal";
import ThemeToggle from "./ThemeToggle";

function ChatIcon({ active }: { active?: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? "#00c8d0" : "none"} stroke={active ? "#00c8d0" : "#8892b0"} strokeWidth="2">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function StarIcon({ active }: { active?: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill={active ? "#00c8d0" : "none"} stroke={active ? "#00c8d0" : "#8892b0"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m12 2.75 2.56 5.19 5.69.82-4.12 4.02.97 5.66L12 0 6.9 18.44l.97-5.66L3.75 8.76l5.69-.82L12 2.75Z" />
    </svg>
  );
}

export default function Sidebar() {
  const { user } = useAuth();
  const { conversations, loading, typingMap } = useConversations();
  const [query, setQuery] = useState("");
  const [showNewChat, setShowNewChat] = useState(false);
  const [activeView, setActiveView] = useState<"chats" | "favorites">("chats");
  const [clearedChatIds, setClearedChatIds] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = JSON.parse(window.localStorage.getItem("signal_clone_cleared_chats") || "[]");
      return Array.isArray(raw) ? raw : [];
    } catch {
      return [];
    }
  });
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = JSON.parse(window.localStorage.getItem("signal_clone_favorites") || "[]");
      return Array.isArray(raw) ? raw : [];
    } catch {
      return [];
    }
  });
  const router = useRouter();
  const pathname = usePathname();

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
    window.localStorage.setItem("signal_clone_cleared_chats", JSON.stringify(clearedChatIds));
  }, [clearedChatIds]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const syncClearedChats = () => {
      try {
        const raw = JSON.parse(window.localStorage.getItem("signal_clone_cleared_chats") || "[]");
        setClearedChatIds(Array.isArray(raw) ? raw : []);
      } catch {
        setClearedChatIds([]);
      }
    };

    syncClearedChats();
    window.addEventListener("signal_clone_cleared_chats_changed", syncClearedChats);
    return () => window.removeEventListener("signal_clone_cleared_chats_changed", syncClearedChats);
  }, []);

  const normalizedConversations = useMemo(() => {
    return conversations.map((conv) =>
      clearedChatIds.includes(conv.id)
        ? { ...conv, last_message: null, unread_count: 0, last_message_at: new Date().toISOString() }
        : conv
    );
  }, [clearedChatIds, conversations]);

  const preferences = (() => {
    if (typeof window === "undefined") return { onlineStatus: true, compactMode: false };
    try {
      const raw = window.localStorage.getItem("signal_clone_preferences");
      return raw ? JSON.parse(raw) : { onlineStatus: true, compactMode: false };
    } catch {
      return { onlineStatus: true, compactMode: false };
    }
  })();

  const compactMode = preferences.compactMode === true;
  const showOnlineStatus = preferences.onlineStatus !== false;
  const favoriteChats = useMemo(() => {
    return normalizedConversations.filter((conv) => {
      if (conv.type !== "direct") return false;
      const other = conv.participants.find((p) => p.user.id !== user?.id)?.user;
      return !!other && favoriteIds.includes(other.id);
    });
  }, [normalizedConversations, favoriteIds, user?.id]);

  const filtered = useMemo(() => {
    if (!query.trim()) return normalizedConversations;
    const q = query.toLowerCase();
    return normalizedConversations.filter((c) => {
      const directName = c.participants.find((p) => p.user.id !== user?.id)?.user.display_name || "";
      const name = (c.name || directName || "").toLowerCase();
      const participantNames = c.participants.map((p) => p.user.display_name.toLowerCase()).join(" ");
      const participantHandles = c.participants.map((p) => (p.user.username || "").toLowerCase()).join(" ");
      return name.includes(q) || participantNames.includes(q) || participantHandles.includes(q);
    });
  }, [normalizedConversations, query, user?.id]);

  const favoriteList = useMemo(() => {
    if (activeView !== "favorites") return favoriteChats;
    return favoriteChats.filter((conv) => {
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      const other = conv.participants.find((p) => p.user.id !== user?.id)?.user;
      const name = (other?.display_name || "").toLowerCase();
      return name.includes(q) || (other?.username || "").toLowerCase().includes(q);
    });
  }, [activeView, favoriteChats, query, user?.id]);

  const addableFavorites = useMemo(() => {
    const directUsers = conversations.flatMap((conv) => {
      if (conv.type !== "direct") return [];
      const other = conv.participants.find((p) => p.user.id !== user?.id)?.user;
      return other ? [other] : [];
    });

    const uniqueUsers = directUsers.filter(
      (person, index, arr) => arr.findIndex((item) => item.id === person.id) === index
    );

    return uniqueUsers.filter((person) => !favoriteIds.includes(person.id));
  }, [conversations, favoriteIds, user?.id]);

  const isChatActive = pathname === "/chat" || pathname.startsWith("/chat/");

  return (
    <div className="flex h-full w-full overflow-hidden select-none">
      <div className="flex w-[60px] shrink-0 flex-col items-center gap-2 bg-[#141828] py-4 border-r border-[#252c44]">
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-[#0d1520] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#00c8d0" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M7 10h10M7 14h7" />
            <path d="M5 18.5V7.5A2.5 2.5 0 0 1 7.5 5h9A2.5 2.5 0 0 1 19 7.5v7A2.5 2.5 0 0 1 16.5 17H9l-4 3v-1.5Z" />
          </svg>
        </div>

        <button
          onClick={() => {
            setActiveView("chats");
            if (pathname !== "/chat") router.push("/chat");
          }}
          title="Chats"
          className={`flex h-11 w-11 items-center justify-center rounded-xl transition cursor-pointer ${
            activeView === "chats" && isChatActive ? "bg-[#00c8d0]/15 shadow-[0_0_12px_rgba(0,200,208,0.2)]" : "hover:bg-[#252c44]"
          }`}
        >
          <ChatIcon active={activeView === "chats" && isChatActive} />
        </button>

        <button
          onClick={() => {
            setActiveView("favorites");
            if (pathname !== "/chat") router.push("/chat");
          }}
          title="Favourites"
          className={`flex h-11 w-11 items-center justify-center rounded-xl transition cursor-pointer ${
            activeView === "favorites" ? "bg-[#00c8d0]/15 shadow-[0_0_12px_rgba(0,200,208,0.2)]" : "hover:bg-[#252c44]"
          }`}
        >
          <StarIcon active={activeView === "favorites"} />
        </button>

        <div className="flex-1" />

        <ThemeToggle compact />

        <button
          onClick={() => router.push("/chat/settings")}
          title="My Account"
          className="mt-2 cursor-pointer"
        >
          <Avatar name={user?.display_name || "?"} src={user?.avatar_url} size={36} showOnlineDot={false} online />
        </button>
      </div>

      <div className="flex flex-1 flex-col bg-[#181d30] overflow-hidden">
        <div className="flex h-[64px] shrink-0 items-center justify-between border-b border-[#252c44] px-4">
          <h2 className="text-base font-bold text-gray-100 leading-none">
            Messages
            {(() => {
              const totalUnread = normalizedConversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);
              return totalUnread > 0 ? (
                <span className="ml-2 rounded-full bg-[#00c8d0] px-2 py-0.5 text-[10px] font-bold text-[#141828] align-middle">
                  {totalUnread}
                </span>
              ) : null;
            })()}
          </h2>
          <button
            type="button"
            onClick={() => setShowNewChat(true)}
            title="New chat or group"
            aria-label="New chat or group"
            className="flex h-8 w-8 items-center justify-center rounded-full text-xl font-light text-[#00c8d0] hover:bg-[#00c8d0]/15 hover:text-white transition cursor-pointer"
          >
            +
          </button>
        </div>

        <div className="px-3 py-2.5 border-b border-[#252c44]/60">
          <div className="relative flex items-center">
            <svg className="absolute left-3 h-4 w-4 text-[#8892b0]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search or start new chat..."
              className="w-full rounded-xl bg-[#1e2236] border border-[#252c44] pl-9 pr-4 py-2 text-xs text-gray-200 outline-none placeholder:text-[#8892b0] focus:border-[#00c8d0] focus:bg-[#222840] transition"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {activeView === "favorites" && (
            <div className="border-b border-[#252c44]/60 px-3 py-2.5">
              <div className="mb-2 flex items-center gap-2 px-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#8892b0]">
                <span>★</span>
                <span>Favourites</span>
              </div>

              {addableFavorites.length > 0 && (
                <div className="mb-3 rounded-xl border border-[#252c44] bg-[#1b2135] p-2">
                  <div className="mb-2 px-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#8892b0]">
                    Add people
                  </div>
                  <div className="flex flex-col gap-1">
                    {addableFavorites.map((person) => (
                      <button
                        key={person.id}
                        type="button"
                        onClick={() => {
                          setFavoriteIds((prev) => {
                            const next = prev.includes(person.id) ? prev : [...prev, person.id];
                            window.localStorage.setItem("signal_clone_favorites", JSON.stringify(next));
                            window.dispatchEvent(new Event("signal_clone_favorites_changed"));
                            return next;
                          });
                        }}
                        className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-[#222840] transition cursor-pointer"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Avatar name={person.display_name} src={person.avatar_url} size={24} showOnlineDot={showOnlineStatus} online={person.is_online} />
                          <span className="truncate text-xs font-semibold text-gray-100">{person.display_name}</span>
                        </div>
                        <span className="text-sm text-[#00c8d0]">＋</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {favoriteList.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#252c44] bg-[#1b2135] p-3 text-center text-xs text-[#8892b0]">
                  No favourite contacts yet
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  {favoriteList.map((conv) => {
                    const other = conv.participants.find((p) => p.user.id !== user?.id)?.user;
                    if (!other) return null;
                    return (
                      <button
                        key={conv.id}
                        onClick={() => router.push(`/chat/${conv.id}`)}
                        className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-[#1e2236] transition cursor-pointer"
                      >
                        <Avatar name={other.display_name} src={other.avatar_url} size={28} showOnlineDot={showOnlineStatus} online={other.is_online} />
                        <span className="truncate text-xs font-semibold text-gray-100">{other.display_name}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {loading && (
            <div className="space-y-1 p-2" aria-label="Loading conversations">
              {[0, 1, 2, 3, 4].map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-xl px-2 py-3">
                  <div className="h-11 w-11 shrink-0 animate-pulse rounded-full bg-[#252c44]" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="h-3 w-2/3 animate-pulse rounded bg-[#252c44]" />
                    <div className="h-2.5 w-1/2 animate-pulse rounded bg-[#252c44]" />
                  </div>
                </div>
              ))}
            </div>
          )}
          {!loading && activeView !== "favorites" && filtered.length === 0 && (
            <div className="p-6 text-center">
              <p className="text-sm font-semibold text-gray-300">No chats yet</p>
              <button
                onClick={() => setShowNewChat(true)}
                className="mt-3 rounded-xl px-4 py-2 text-xs font-bold text-[#141828] cursor-pointer transition"
                style={{ background: "linear-gradient(90deg, #00b8c8, #00c8d0)" }}
              >
                Start New Chat
              </button>
            </div>
          )}

          {activeView !== "favorites" && filtered.map((conv) => {
            const isActive = pathname === `/chat/${conv.id}`;
            const otherParticipant = conv.type === "direct"
              ? conv.participants.find((p) => p.user.id !== user?.id)?.user
              : null;
            const otherOnline = otherParticipant?.is_online || false;
            const convTyping = typingMap[conv.id];
            const previewText = conv.last_message?.content?.trim();
            const previewAttachment = previewText && /^(?:https?:\/\/|\/api\/upload\/files\/)/i.test(previewText)
              ? previewText.split(/[?#]/)[0].split("/").pop() || "Attachment"
              : null;
            const preview = convTyping && convTyping.length > 0
              ? "typing…"
              : previewText
                ? `${conv.last_message?.sender_id === user?.id ? "You: " : ""}${previewAttachment || previewText}`
                : "";

            return (
              <button
                key={conv.id}
                onClick={() => router.push(`/chat/${conv.id}`)}
                className={`relative flex w-full items-center gap-3 px-3.5 transition cursor-pointer border-b border-[#252c44]/30 ${
                  compactMode ? "py-2" : "py-3"
                } ${
                  isActive ? "bg-[#222840] border-l-2 border-l-[#00c8d0]" : "hover:bg-[#1e2236]"
                }`}
              >
                <Avatar
                  name={conv.name || otherParticipant?.display_name || "Group"}
                  src={conv.avatar_url || otherParticipant?.avatar_url}
                  size={compactMode ? 40 : 44}
                  showOnlineDot={conv.type === "direct" && showOnlineStatus}
                  online={otherOnline}
                />

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-gray-100">
                      {conv.name || otherParticipant?.display_name || "Unnamed"}
                    </span>
                    <span className="shrink-0 text-[11px] text-[#8892b0]">
                      {formatConversationTime(conv.last_message_at)}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between gap-2">
                    {preview ? (
                      <span className={`truncate text-xs ${
                        convTyping && convTyping.length > 0 ? "italic font-semibold text-[#00c8d0]" : "text-[#8892b0]"
                      }`}>
                        {preview}
                      </span>
                    ) : (
                      <span className="truncate text-xs text-[#8892b0]">No messages yet</span>
                    )}
                    {conv.unread_count > 0 && (
                      <span className="flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full px-1.5 text-[10px] font-bold text-[#141828]"
                        style={{ background: "linear-gradient(135deg, #00b8c8, #00c8d0)" }}>
                        {conv.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {showNewChat && <NewChatModal onClose={() => setShowNewChat(false)} />}
    </div>
  );
}
