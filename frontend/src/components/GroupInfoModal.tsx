"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { Conversation, User } from "@/lib/types";
import Avatar from "./Avatar";

export default function GroupInfoModal({
  conversation,
  onClose,
  onUpdated,
}: {
  conversation: Conversation;
  onClose: () => void;
  onUpdated: (c: Conversation) => void;
}) {
  const { user } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [contacts, setContacts] = useState<User[]>([]);
  const router = useRouter();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const myRole = conversation.participants.find((p) => p.user.id === user?.id)?.role;
  const isAdmin = myRole === "admin";
  const memberIds = new Set(conversation.participants.map((p) => p.user.id));

  useEffect(() => {
    if (showAdd) {
      api.listContacts().then((cs) => setContacts(cs.map((c) => c.user).filter((u) => !memberIds.has(u.id))));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAdd]);

  async function handleAdd(u: User) {
    setBusy(true);
    setError(null);
    try {
      const updated = await api.addGroupMember(conversation.id, u.id);
      onUpdated(updated);
      setShowAdd(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add member");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(userId: string) {
    setBusy(true);
    setError(null);
    try {
      const updated = await api.removeGroupMember(conversation.id, userId);
      onUpdated(updated);
      if (userId === user?.id) {
        onClose();
        router.push("/chat");
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to remove member");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs px-4" onClick={onClose}>
      <div
        className="flex max-h-[80vh] w-full max-w-md flex-col rounded-3xl bg-white shadow-2xl border border-gray-200 text-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col items-center gap-2 border-b border-gray-200 px-6 py-6">
          <Avatar name={conversation.name || "Group"} src={conversation.avatar_url} size={72} />
          <h2 className="text-xl font-extrabold text-gray-900">{conversation.name}</h2>
          <p className="text-sm font-medium text-gray-500">{conversation.participants.length} members</p>
        </div>

        {error && <p className="px-6 pt-3 text-xs font-semibold text-red-600">{error}</p>}

        <div className="flex-1 overflow-y-auto px-4 py-3 divide-y divide-gray-100">
          {isAdmin && (
            <button
              onClick={() => setShowAdd((s) => !s)}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[#2c6bed] hover:bg-blue-50 font-semibold transition"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-[#2c6bed] font-bold">+</span>
              Add Members
            </button>
          )}

          {showAdd && (
            <div className="mb-2 max-h-40 overflow-y-auto rounded-xl bg-gray-50 p-2 border border-gray-200 divide-y divide-gray-200">
              {contacts.length === 0 && (
                <p className="px-3 py-3 text-center text-xs text-gray-400">No contacts to add</p>
              )}
              {contacts.map((u) => (
                <button
                  key={u.id}
                  disabled={busy}
                  onClick={() => handleAdd(u)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-white disabled:opacity-50"
                >
                  <Avatar name={u.display_name} src={u.avatar_url} size={32} />
                  <span className="text-sm font-semibold text-gray-900">{u.display_name}</span>
                </button>
              ))}
            </div>
          )}

          <p className="px-3 pb-1 pt-3 text-xs font-bold uppercase tracking-wider text-gray-400">
            Group Members
          </p>
          {conversation.participants.map((p) => (
            <div key={p.user.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-gray-50">
              <Avatar name={p.user.display_name} src={p.user.avatar_url} size={38} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-gray-900">
                  {p.user.display_name} {p.user.id === user?.id && <span className="text-gray-400 font-normal">(you)</span>}
                </p>
                {p.role === "admin" && <p className="text-xs font-semibold text-[#2c6bed]">Group Admin</p>}
              </div>
              {(isAdmin && p.user.id !== user?.id) || p.user.id === user?.id ? (
                <button
                  disabled={busy}
                  onClick={() => handleRemove(p.user.id)}
                  className="text-xs font-bold text-red-600 hover:text-red-700 disabled:opacity-50"
                >
                  {p.user.id === user?.id ? "Leave" : "Remove"}
                </button>
              ) : null}
            </div>
          ))}
        </div>

        <div className="border-t border-gray-200 px-6 py-4">
          <button onClick={onClose} className="w-full text-center text-sm font-bold text-gray-500 hover:text-gray-900">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
