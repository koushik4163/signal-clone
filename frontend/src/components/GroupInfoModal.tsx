"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
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
  const [personQuery, setPersonQuery] = useState("");
  const [groupName, setGroupName] = useState(conversation.name || "");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const groupPhotoInputRef = useRef<HTMLInputElement>(null);
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
  const memberIds = useMemo(
    () => new Set(conversation.participants.map((p) => p.user.id)),
    [conversation.participants]
  );

  useEffect(() => {
    if (showAdd) {
      api.listContacts().then((cs) =>
        setContacts(cs.map((c) => c.user).filter((u) => !memberIds.has(u.id)))
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAdd]);

  useEffect(() => {
    if (!showAdd || !personQuery.trim()) return;
    const timer = setTimeout(() => {
      api.searchUsers(personQuery.trim()).then((users) => {
        setContacts(users.filter((u) => !memberIds.has(u.id)));
      }).catch(() => setContacts([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [showAdd, personQuery, memberIds]);

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

  async function handleSaveInfo() {
    setBusy(true);
    setError(null);
    try {
      const updated = await api.updateGroup(conversation.id, { name: groupName });
      onUpdated(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update group info");
    } finally {
      setBusy(false);
    }
  }

  async function handleGroupPhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    setError(null);
    try {
      const uploaded = await api.uploadFile(file);
      const updated = await api.updateGroup(conversation.id, { name: groupName, avatar_url: uploaded.url });
      onUpdated(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update group photo");
    } finally {
      setUploadingPhoto(false);
      if (groupPhotoInputRef.current) groupPhotoInputRef.current.value = "";
    }
  }

  async function handleRemoveGroupPhoto() {
    setUploadingPhoto(true);
    setError(null);
    try {
      const updated = await api.updateGroup(conversation.id, { name: groupName, avatar_url: null });
      onUpdated(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to remove group photo");
    } finally {
      setUploadingPhoto(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(10,14,28,0.75)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-md flex-col rounded-2xl border border-[#252c44] shadow-2xl"
        style={{ background: "#181d30" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex flex-col items-center gap-2 border-b border-[#252c44] px-6 py-6">
          <Avatar name={conversation.name || "Group"} src={conversation.avatar_url} size={72} />
          <h2 className="text-xl font-extrabold text-gray-100">{conversation.name}</h2>
          <p className="text-sm font-medium text-[#8892b0]">
            {conversation.participants.length} members
          </p>
          {isAdmin && (
            <div className="mt-2 flex w-full gap-2">
              <input value={groupName} onChange={(e) => setGroupName(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-[#252c44] bg-[#1e2236] px-3 py-2 text-sm text-gray-100 outline-none focus:border-[#00c8d0]" />
              <button disabled={busy} onClick={handleSaveInfo} className="rounded-lg bg-[#00c8d0] px-3 py-2 text-xs font-bold text-[#0d1117] disabled:opacity-50">Save</button>
            </div>
          )}
          {isAdmin && (
            <div className="flex gap-2">
              <input ref={groupPhotoInputRef} type="file" accept="image/*" onChange={handleGroupPhoto} className="hidden" />
              <button disabled={uploadingPhoto} onClick={() => groupPhotoInputRef.current?.click()} className="text-xs font-semibold text-[#00c8d0] hover:text-white disabled:opacity-50">
                {uploadingPhoto ? "Updating…" : "Update photo"}
              </button>
              <button disabled={uploadingPhoto || !conversation.avatar_url} onClick={handleRemoveGroupPhoto} className="text-xs font-semibold text-red-400 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-40">Remove photo</button>
            </div>
          )}
        </div>

        {error && (
          <p className="px-6 pt-3 text-xs font-semibold text-red-400">{error}</p>
        )}

        {/* Members list */}
        <div className="flex-1 overflow-y-auto px-4 py-3 divide-y divide-[#1e2236]">
          {isAdmin && (
            <button
              onClick={() => setShowAdd((s) => !s)}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[#00c8d0] hover:bg-[#1e2236] font-semibold transition cursor-pointer"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#00c8d0]/10 text-[#00c8d0] font-bold border border-[#00c8d0]/30">
                +
              </span>
              Add Members
            </button>
          )}

          {showAdd && (
            <div className="mb-2 rounded-xl bg-[#1e2236] p-2 border border-[#252c44]">
              <input
                value={personQuery}
                onChange={(e) => setPersonQuery(e.target.value)}
                placeholder="Search anyone to add"
                className="mb-2 w-full rounded-lg border border-[#252c44] bg-[#181d30] px-3 py-2 text-xs text-gray-100 outline-none placeholder-[#8892b0] focus:border-[#00c8d0]"
              />
              <div className="max-h-40 overflow-y-auto divide-y divide-[#252c44]">
              {contacts.length === 0 && (
                <p className="px-3 py-3 text-center text-xs text-[#8892b0]">No people found</p>
              )}
              {contacts.map((u) => (
                <button
                  key={u.id}
                  disabled={busy}
                  onClick={() => handleAdd(u)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-[#252c44] disabled:opacity-50 cursor-pointer"
                >
                  <Avatar name={u.display_name} src={u.avatar_url} size={32} />
                  <span className="text-sm font-semibold text-gray-100">{u.display_name}</span>
                </button>
              ))}
              </div>
            </div>
          )}

          <p className="px-3 pb-1 pt-3 text-[10px] font-bold uppercase tracking-widest text-[#8892b0]">
            Group Members
          </p>
          {conversation.participants.map((p) => (
            <div
              key={p.user.id}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-[#1e2236] transition"
            >
              <Avatar name={p.user.display_name} src={p.user.avatar_url} size={38} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-gray-100">
                  {p.user.display_name}{" "}
                  {p.user.id === user?.id && (
                    <span className="text-[#8892b0] font-normal">(you)</span>
                  )}
                </p>
                {p.role === "admin" && (
                  <p className="text-xs font-semibold text-[#00c8d0]">Group Admin</p>
                )}
              </div>
              {((isAdmin && p.user.id !== user?.id) || p.user.id === user?.id) ? (
                <button
                  disabled={busy}
                  onClick={() => handleRemove(p.user.id)}
                  className="text-xs font-bold text-red-400 hover:text-red-300 disabled:opacity-50 cursor-pointer"
                >
                  {p.user.id === user?.id ? "Leave" : "Remove"}
                </button>
              ) : null}
            </div>
          ))}
        </div>

        {/* Close footer */}
        <div className="border-t border-[#252c44] px-6 py-4">
          <button
            onClick={onClose}
            className="w-full text-center text-sm font-bold text-[#8892b0] hover:text-white transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
