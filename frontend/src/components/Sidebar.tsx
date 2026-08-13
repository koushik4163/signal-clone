"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useConversations } from "@/lib/conversations-context";
import Avatar from "./Avatar";
import { formatConversationTime } from "@/lib/format";
import NewChatModal from "./NewChatModal";
import { api } from "@/lib/api";
import type { Contact } from "@/lib/types";

export default function Sidebar() {
  const { user } = useAuth();
  const { conversations, loading, typingMap, upsertConversation } = useConversations();
  const [query, setQuery] = useState("");
  const [contactQuery, setContactQuery] = useState("");
  const [showNewChat, setShowNewChat] = useState(false);
  const [view, setView] = useState<"chats" | "contacts">("chats");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (view !== "contacts") return;
    api.listContacts()
      .then((data) => setContacts(data))
      .catch(() => setContacts([]));
  }, [view]);

  const refreshContacts = () => {
    api.listContacts()
      .then((data) => setContacts(data))
      .catch(() => setContacts([]));
  };

  const isCompact = typeof window !== "undefined" && window.localStorage.getItem("signal_clone_preferences")
    ? JSON.parse(window.localStorage.getItem("signal_clone_preferences") || "{}").compactMode
    : false;

  const displayUserNumber = user?.phone_number || (user?.username ? `@${user.username}` : "Signal User");

  const filtered = useMemo(() => {
    if (!query.trim()) return conversations;
    const q = query.toLowerCase();
    return conversations.filter((c) => {
      const directName = c.participants.find((p) => p.user.id !== user?.id)?.user.display_name || "";
      const name = (c.name || directName || "").toLowerCase();
      const participantNames = c.participants
        .map((p) => p.user.display_name.toLowerCase())
        .join(" ");
      const participantHandles = c.participants
        .map((p) => (p.user.username || "").toLowerCase())
        .join(" ");
      return name.includes(q) || participantNames.includes(q) || participantHandles.includes(q);
    });
  }, [conversations, query, user?.id]);

  const filteredContacts = useMemo(() => {
    if (!contactQuery.trim()) return contacts;
    const q = contactQuery.toLowerCase();
    return contacts.filter((contact) => {
      const user = contact.user;
      return (
        user.display_name.toLowerCase().includes(q) ||
        (user.username || "").toLowerCase().includes(q) ||
        user.phone_number.toLowerCase().includes(q)
      );
    });
  }, [contacts, contactQuery]);

  async function startChatWithContact(contactUserId: string) {
    try {
      const conv = await api.createDirectConversation(contactUserId);
      upsertConversation(conv);
      router.push(`/chat/${conv.id}`);
    } catch {
      // no-op: keep sidebar stable even if chat creation fails
    }
  }

  async function removeContact(contactId: string) {
    try {
      await api.removeContact(contactId);
      refreshContacts();
    } catch {
      // no-op: keep UI stable even if removal fails
    }
  }

  return (
    <div className="flex h-full w-full flex-col border-r border-[var(--border-color)] bg-[var(--sidebar-bg)] text-[var(--foreground)]">
      <div className="flex items-center justify-between border-b border-[var(--border-color)] bg-[var(--sidebar-bg)] px-4 py-3">
        <button
          onClick={() => router.push("/chat/settings")}
          className="mr-2 flex min-w-0 flex-1 items-center gap-3 rounded-xl p-1.5 text-left transition hover:bg-[var(--panel-alt)]"
          title="Settings & Profile"
        >
          <Avatar name={user?.display_name || "?"} src={user?.avatar_url} size={40} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold leading-tight text-[var(--foreground)]">{user?.display_name || "Profile"}</p>
            <p className="truncate text-xs font-semibold text-[#2c6bed]">{displayUserNumber}</p>
          </div>
        </button>

        <button
          onClick={() => setShowNewChat(true)}
          title="New chat"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--panel-alt)] text-[var(--foreground)] transition hover:bg-[var(--input-bg)]"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="border-b border-[var(--border-color)] bg-[var(--sidebar-bg)] px-3 py-2">
        <div className="grid grid-cols-2 gap-2 rounded-full bg-[var(--panel-alt)] p-1">
          <button
            onClick={() => setView("chats")}
            className={`rounded-full px-2 py-1.5 text-xs font-bold transition ${
              view === "chats" ? "bg-[var(--panel-bg)] text-[#2c6bed] shadow-sm" : "text-[var(--muted)]"
            }`}
          >
            Chats
          </button>
          <button
            onClick={() => setView("contacts")}
            className={`rounded-full px-2 py-1.5 text-xs font-bold transition ${
              view === "contacts" ? "bg-[var(--panel-bg)] text-[#2c6bed] shadow-sm" : "text-[var(--muted)]"
            }`}
          >
            Contacts
          </button>
        </div>
      </div>

      <div className="border-b border-[var(--border-color)] bg-[var(--sidebar-bg)] px-3 py-2.5">
        <div className="relative flex items-center">
          <svg className="absolute left-3.5 h-4 w-4 text-[var(--muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={view === "chats" ? query : contactQuery}
            onChange={(e) => (view === "chats" ? setQuery(e.target.value) : setContactQuery(e.target.value))}
            placeholder={view === "chats" ? "Search chats" : "Search contacts"}
            className="w-full rounded-full border border-[var(--border-color)] bg-[var(--panel-alt)] pl-10 pr-4 py-2 text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted)] focus:border-[#2c6bed] focus:bg-[var(--panel-bg)] focus:ring-1 focus:ring-[#2c6bed]"
          />
        </div>
      </div>

      {view === "chats" ? (
        <div className="flex-1 divide-y divide-[var(--border-color)] overflow-y-auto bg-[var(--sidebar-bg)]">
          {loading && <p className="px-4 py-6 text-center text-sm text-[var(--muted)]">Loading conversations...</p>}
          {!loading && filtered.length === 0 && (
            <div className="p-6 text-center text-sm text-[var(--muted)]">
              <p className="font-medium text-[var(--foreground)]">No conversations found</p>
              <button
                onClick={() => setShowNewChat(true)}
                className="mt-3 rounded-lg bg-[#2c6bed] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1d5bd8] transition shadow-xs"
              >
                Start New Chat
              </button>
            </div>
          )}
          {filtered.map((conv) => {
            const isActive = pathname === `/chat/${conv.id}`;
            const otherParticipant = conv.type === "direct" ? conv.participants.find((p) => p.user.id !== user?.id)?.user : null;
            const otherOnline = otherParticipant?.is_online || false;
            const convTyping = typingMap[conv.id];
            const preview = convTyping && convTyping.length > 0
              ? `${convTyping.join(", ")} typing...`
              : conv.last_message?.content
                ? `${conv.last_message.sender_id === user?.id ? "You: " : ""}${conv.last_message.content}`
                : "No messages yet";

            return (
              <button
                key={conv.id}
                onClick={() => router.push(`/chat/${conv.id}`)}
                className={`relative flex w-full items-center gap-3 px-3.5 transition hover:bg-[var(--panel-alt)] ${
                  isCompact ? "py-2" : "py-3"
                } ${isActive ? "border-l-4 border-[#2c6bed] bg-[var(--panel-alt)]" : ""}`}
              >
                <Avatar
                  name={conv.name || "Group"}
                  src={conv.avatar_url}
                  size={isCompact ? 40 : 46}
                  showOnlineDot={conv.type === "direct"}
                  online={otherOnline}
                />

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-[var(--foreground)]">{conv.name || "Unnamed"}</span>
                    <span className="shrink-0 text-xs font-normal text-[var(--muted)]">
                      {formatConversationTime(conv.last_message_at)}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between gap-2">
                    <span className={`truncate text-xs ${convTyping && convTyping.length > 0 ? "italic font-semibold text-[#2c6bed]" : "text-[var(--muted)]"}`}>
                      {preview}
                    </span>
                    {conv.unread_count > 0 && (
                      <span className="flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-[#2c6bed] px-1.5 text-[11px] font-bold text-white shadow-xs">
                        {conv.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="flex-1 divide-y divide-[var(--border-color)] overflow-y-auto bg-[var(--sidebar-bg)]">
          {filteredContacts.length === 0 ? (
            <div className="p-6 text-center text-sm text-[var(--muted)]">
              <p className="font-medium text-[var(--foreground)]">No contacts found</p>
              <button
                onClick={() => setShowNewChat(true)}
                className="mt-3 rounded-lg bg-[#2c6bed] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1d5bd8] transition shadow-xs"
              >
                Add Contact
              </button>
            </div>
          ) : (
            filteredContacts.map((contact) => (
              <div key={contact.id} className="flex items-center gap-3 px-3.5 py-3 transition hover:bg-[var(--panel-alt)]">
                <Avatar
                  name={contact.user.display_name}
                  src={contact.user.avatar_url}
                  size={42}
                  showOnlineDot={true}
                  online={contact.user.is_online}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[var(--foreground)]">{contact.user.display_name}</p>
                  <p className="truncate text-xs text-[var(--muted)]">
                    {contact.user.username ? `@${contact.user.username}` : contact.user.phone_number}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => startChatWithContact(contact.user.id)}
                    className="rounded-full bg-[#2c6bed] px-3 py-1.5 text-[11px] font-bold text-white hover:bg-[#1d5bd8]"
                  >
                    Message
                  </button>
                  <button
                    onClick={() => removeContact(contact.id)}
                    className="rounded-full border border-red-200 px-2.5 py-1.5 text-[11px] font-bold text-red-600 hover:bg-red-50"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {showNewChat && (
        <NewChatModal
          onClose={() => setShowNewChat(false)}
          onContactAdded={(contact) => {
            setContacts((prev) => {
              if (prev.some((item) => item.id === contact.id || item.user.id === contact.user.id)) return prev;
              return [contact, ...prev];
            });
          }}
        />
      )}
    </div>
  );
}
