"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { useConversations } from "@/lib/conversations-context";
import type { User } from "@/lib/types";
import Avatar from "./Avatar";

type Tab = "direct" | "group";

export default function NewChatModal({
  onClose,
}: {
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>("direct");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<User[]>([]);
  const [selected, setSelected] = useState<User[]>([]);
  const [groupName, setGroupName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const handle = setTimeout(() => {
      api.searchUsers(query.trim()).then(setResults).catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(handle);
  }, [query]);

  const listToShow = results;

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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(10,14,28,0.7)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <div
        className="flex max-h-[82vh] w-full max-w-md flex-col rounded-2xl border border-[#252c44] shadow-2xl"
        style={{ background: "#181d30" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#252c44] px-6 py-4">
          <h2 className="text-base font-bold text-gray-100">
            {tab === "direct" ? "New Chat" : "New Group"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition text-xl font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 px-6 pt-4">
          {(["direct", "group"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-full px-4 py-1.5 text-xs font-bold transition cursor-pointer capitalize ${
                tab === t
                  ? "bg-[#00c8d0] text-[#0d1117]"
                  : "bg-[#1e2236] text-gray-400 hover:text-white border border-[#252c44]"
              }`}
            >
              {t === "direct" ? "Direct Chat" : "Group Chat"}
            </button>
          ))}
        </div>

        {/* Group name input */}
        {tab === "group" && (
          <div className="px-6 pt-3">
            <input
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Group name"
              className="w-full rounded-xl border border-[#252c44] bg-[#1e2236] px-3.5 py-2.5 text-sm text-gray-100 outline-none placeholder-gray-500 focus:border-[#00c8d0]"
            />
            {selected.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {selected.map((u) => (
                  <span
                    key={u.id}
                    className="flex items-center gap-1.5 rounded-full border border-[#252c44] bg-[#1e2236] px-3 py-1 text-xs font-semibold text-[#00c8d0]"
                  >
                    {u.display_name}
                    <button onClick={() => toggleSelect(u)} className="hover:text-red-400 cursor-pointer">✕</button>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Search */}
        <div className="px-6 pt-3">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8892b0" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, username, or phone"
              className="w-full rounded-xl border border-[#252c44] bg-[#1e2236] pl-9 pr-4 py-2.5 text-sm text-gray-100 outline-none placeholder-gray-500 focus:border-[#00c8d0]"
            />
          </div>
        </div>

        {error && (
          <p className="px-6 pt-2 text-xs font-semibold text-red-400">{error}</p>
        )}

        {/* Results list */}
        <div className="mt-2 flex-1 overflow-y-auto px-3 pb-4 divide-y divide-[#1e2236]">
          {listToShow.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-[#8892b0]">
              No users found
            </p>
          )}
          {listToShow.map((u) => {
            const isSelected = selected.some((s) => s.id === u.id);
            return (
              <div
                key={u.id}
                className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-[#1e2236] transition"
              >
                <button
                  disabled={busy}
                  onClick={() => (tab === "direct" ? startDirect(u) : toggleSelect(u))}
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-2 text-left disabled:opacity-50 cursor-pointer"
                >
                  <Avatar name={u.display_name} src={u.avatar_url} size={40} online={u.is_online} showOnlineDot />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-gray-100">{u.display_name}</p>
                    <p className="truncate text-xs text-[#8892b0]">
                      {u.username ? `@${u.username}` : u.phone_number}
                    </p>
                  </div>
                  {tab === "group" && (
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full border-2 text-xs font-bold transition ${
                        isSelected
                          ? "border-[#00c8d0] bg-[#00c8d0] text-[#0d1117]"
                          : "border-[#252c44]"
                      }`}
                    >
                      {isSelected && "✓"}
                    </span>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* Group create button */}
        {tab === "group" && (
          <div className="border-t border-[#252c44] px-6 py-4">
            <button
              onClick={createGroup}
              disabled={busy || !groupName.trim() || selected.length === 0}
              className="w-full rounded-xl py-3 font-bold text-sm text-[#0d1117] transition disabled:opacity-40 cursor-pointer"
              style={{
                background:
                  busy || !groupName.trim() || selected.length === 0
                    ? "#1e2236"
                    : "linear-gradient(90deg, #00b8c8, #00c8d0)",
                color:
                  busy || !groupName.trim() || selected.length === 0 ? "#4a5580" : "#0d1117",
              }}
            >
              {busy
                ? "Creating..."
                : `Create Group (${selected.length} member${selected.length === 1 ? "" : "s"})`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
