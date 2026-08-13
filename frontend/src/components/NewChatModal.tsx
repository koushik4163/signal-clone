"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useConversations } from "@/lib/conversations-context";
import type { Contact, User } from "@/lib/types";
import Avatar from "./Avatar";

type Tab = "direct" | "group";

export default function NewChatModal({
  onClose,
  onContactAdded,
}: {
  onClose: () => void;
  onContactAdded?: (contact: Contact) => void;
}) {
  const [tab, setTab] = useState<Tab>("direct");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<User[]>([]);
  const [contacts, setContacts] = useState<User[]>([]);
  const [selected, setSelected] = useState<User[]>([]);
  const [groupName, setGroupName] = useState("");
  const [busy, setBusy] = useState(false);
  const [addingContactId, setAddingContactId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const { upsertConversation } = useConversations();
  const router = useRouter();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    api.listContacts().then((cs) => setContacts(cs.map((c) => c.user)));
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const handle = setTimeout(() => {
      api.searchUsers(query.trim()).then(setResults).catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(handle);
  }, [query]);

  const listToShow = query.trim() ? results : contacts;

  async function startDirect(u: User) {
    setBusy(true);
    setError(null);
    try {
      const conv = await api.createDirectConversation(u.id);
      upsertConversation(conv);
      onClose();
      router.push(`/chat/${conv.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to start chat");
    } finally {
      setBusy(false);
    }
  }

  function toggleSelect(u: User) {
    setSelected((prev) =>
      prev.some((p) => p.id === u.id) ? prev.filter((p) => p.id !== u.id) : [...prev, u]
    );
  }

  async function createGroup() {
    if (!groupName.trim() || selected.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const conv = await api.createGroupConversation({
        name: groupName.trim(),
        member_ids: selected.map((u) => u.id),
      });
      upsertConversation(conv);
      onClose();
      router.push(`/chat/${conv.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create group");
    } finally {
      setBusy(false);
    }
  }

  async function addContact(u: User) {
    setError(null);
    setAddingContactId(u.id);
    try {
      const created = await api.addContact({ phone_number: u.phone_number });
      setContacts((prev) => (prev.some((c) => c.id === u.id) ? prev : [u, ...prev]));
      onContactAdded?.(created);
    } catch (err) {
      if (err instanceof ApiError && err.message.toLowerCase().includes("already")) {
        const existing = await api.listContacts();
        setContacts(existing.map((c) => c.user));
        const match = existing.find((c) => c.user.id === u.id);
        if (match) onContactAdded?.(match);
      } else {
        setError(err instanceof ApiError ? err.message : "Failed to add contact");
      }
    } finally {
      setAddingContactId(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs px-4" onClick={onClose}>
      <div
        className="flex max-h-[80vh] w-full max-w-md flex-col rounded-3xl bg-white shadow-2xl border border-gray-200 text-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-bold text-gray-900">
            {tab === "direct" ? "New Chat" : "New Group"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-lg font-bold">
            ✕
          </button>
        </div>

        <div className="flex gap-2 px-6 pt-4">
          <button
            onClick={() => setTab("direct")}
            className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${
              tab === "direct" ? "bg-[#2c6bed] text-white shadow-xs" : "bg-gray-100 text-gray-600 hover:text-gray-900"
            }`}
          >
            Direct Chat
          </button>
          <button
            onClick={() => setTab("group")}
            className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${
              tab === "group" ? "bg-[#2c6bed] text-white shadow-xs" : "bg-gray-100 text-gray-600 hover:text-gray-900"
            }`}
          >
            Group Chat
          </button>
        </div>

        {tab === "group" && (
          <div className="px-6 pt-3">
            <input
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Group name"
              className="w-full rounded-xl border border-gray-300 bg-gray-50 px-3.5 py-2 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:bg-white focus:border-[#2c6bed]"
            />
            {selected.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {selected.map((u) => (
                  <span
                    key={u.id}
                    className="flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-200 px-3 py-1 text-xs font-semibold text-[#2c6bed]"
                  >
                    {u.display_name}
                    <button onClick={() => toggleSelect(u)} className="hover:text-red-500">✕</button>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="px-6 pt-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, username, or phone"
            className="w-full rounded-xl border border-gray-300 bg-gray-50 px-3.5 py-2 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:bg-white focus:border-[#2c6bed]"
          />
        </div>

        {error && <p className="px-6 pt-2 text-xs font-semibold text-red-600">{error}</p>}

        <div className="mt-2 flex-1 overflow-y-auto px-3 pb-4 divide-y divide-gray-100">
          {!query.trim() && (
            <p className="px-3 pb-1 pt-3 text-xs font-bold uppercase tracking-wider text-gray-400">
              Contacts
            </p>
          )}
          {listToShow.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-gray-400">No users found</p>
          )}
          {listToShow.map((u) => {
            const isSelected = selected.some((s) => s.id === u.id);
            const isContact = contacts.some((c) => c.id === u.id);
            return (
              <div key={u.id} className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-gray-50 transition">
                <button
                  disabled={busy}
                  onClick={() => (tab === "direct" ? startDirect(u) : toggleSelect(u))}
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-1.5 text-left disabled:opacity-50"
                >
                  <Avatar name={u.display_name} src={u.avatar_url} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-gray-900">{u.display_name}</p>
                    <p className="truncate text-xs text-gray-500">{u.username ? `@${u.username}` : u.phone_number}</p>
                  </div>
                  {tab === "group" && (
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full border-2 text-xs font-bold ${
                        isSelected ? "border-[#2c6bed] bg-[#2c6bed] text-white" : "border-gray-300"
                      }`}
                    >
                      {isSelected && "✓"}
                    </span>
                  )}
                </button>

                {tab === "direct" && u.id !== user?.id && (
                  <button
                    disabled={busy}
                    onClick={() => {
                      if (!isContact) addContact(u);
                      startDirect(u);
                    }}
                    title={isContact ? "Open chat" : "Add contact and start chat"}
                    className="flex shrink-0 items-center gap-1 rounded-full bg-[#2c6bed] px-3 py-1.5 text-xs font-bold text-white transition hover:bg-[#1d5bd8] shadow-xs active:scale-95 disabled:opacity-50"
                  >
                    <span className="text-sm leading-none font-extrabold">+</span>
                    <span>{isContact ? "Chat" : "Add"}</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {tab === "group" && (
          <div className="border-t border-gray-200 px-6 py-4">
            <button
              onClick={createGroup}
              disabled={busy || !groupName.trim() || selected.length === 0}
              className="w-full rounded-xl bg-[#2c6bed] px-4 py-3 font-bold text-white transition hover:bg-[#1d5bd8] shadow-md disabled:opacity-40"
            >
              {busy ? "Creating..." : `Create Group (${selected.length} member${selected.length === 1 ? "" : "s"})`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
