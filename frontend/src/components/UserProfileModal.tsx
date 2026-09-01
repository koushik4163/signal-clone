"use client";

import { useEffect } from "react";
import Avatar from "./Avatar";
import type { User } from "@/lib/types";

export default function UserProfileModal({
  user,
  isFavorite,
  isBlocked,
  onClose,
  onToggleFavorite,
  onToggleBlock,
  onClearChat,
}: {
  user: User | null;
  isFavorite: boolean;
  isBlocked: boolean;
  onClose: () => void;
  onToggleFavorite: () => void;
  onToggleBlock: () => void;
  onClearChat: () => void;
}) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!user) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(10,14,28,0.75)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-[#252c44] bg-[#181d30] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-[#252c44] px-6 py-6 text-center">
          <div className="mb-3 flex justify-center">
            <Avatar name={user.display_name} src={user.avatar_url} size={82} />
          </div>
          <h2 className="text-xl font-extrabold text-gray-100">{user.display_name}</h2>
          <p className="mt-1 text-xs text-[#8892b0]">@{user.username || "unknown"}</p>
        </div>

        <div className="space-y-4 px-6 py-5 text-sm text-gray-200">
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#8892b0]">Phone</p>
            <p className="rounded-xl bg-[#1e2236] px-3 py-2 text-sm text-gray-100">{user.phone_number}</p>
          </div>

          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#8892b0]">About</p>
            <p className="rounded-xl bg-[#1e2236] px-3 py-2 text-sm text-gray-200">
              {user.about || "No bio added yet."}
            </p>
          </div>
        </div>

        <div className="space-y-2 border-t border-[#252c44] px-6 py-4">
          <button
            type="button"
            onClick={onToggleFavorite}
            className="flex w-full items-center justify-between rounded-xl bg-[#1e2236] px-3 py-2.5 text-sm font-semibold text-gray-100 transition hover:bg-[#252c44] cursor-pointer"
          >
            <span>{isFavorite ? "Remove from favourites" : "Add to favourites"}</span>
            <span>{isFavorite ? "★" : "☆"}</span>
          </button>

          <button
            type="button"
            onClick={onToggleBlock}
            className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold transition cursor-pointer ${
              isBlocked
                ? "bg-red-500/10 text-red-300 hover:bg-red-500/20"
                : "bg-[#1e2236] text-gray-100 hover:bg-[#252c44]"
            }`}
          >
            <span>{isBlocked ? "Unblock user" : "Block user"}</span>
            <span>{isBlocked ? "🔒" : "🔓"}</span>
          </button>

          <button
            type="button"
            onClick={onClearChat}
            className="flex w-full items-center justify-between rounded-xl bg-[#1e2236] px-3 py-2.5 text-sm font-semibold text-red-300 transition hover:bg-[#252c44] cursor-pointer"
          >
            <span>Clear chat</span>
            <span>🗑️</span>
          </button>
        </div>

        <div className="border-t border-[#252c44] px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="w-full text-center text-sm font-bold text-[#8892b0] transition hover:text-white cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
