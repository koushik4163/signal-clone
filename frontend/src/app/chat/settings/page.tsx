"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError, API_URL, getToken } from "@/lib/api";
import { useToast } from "@/components/Toast";
import Avatar from "@/components/Avatar";

type PreferenceKey = "notifications" | "readReceipts" | "onlineStatus" | "compactMode";

const DEFAULT_PREFERENCES: Record<PreferenceKey, boolean> = {
  notifications: true,
  readReceipts: true,
  onlineStatus: true,
  compactMode: false,
};

const PREFERENCE_ROWS: Array<{ key: PreferenceKey; icon: string; label: string; desc: string }> = [
  { key: "notifications", icon: "🔔", label: "Message notifications", desc: "Receive alerts for new messages" },
  { key: "readReceipts", icon: "✓✓", label: "Read receipts", desc: "Let contacts see when you've read messages" },
  { key: "onlineStatus", icon: "●", label: "Online status", desc: "Show when you're active to contacts" },
  { key: "compactMode", icon: "☰", label: "Compact mode", desc: "Tighter spacing in conversation list" },
];

function getStoredPreferences(): Record<PreferenceKey, boolean> {
  if (typeof window === "undefined") return DEFAULT_PREFERENCES;
  try {
    const raw = window.localStorage.getItem("signal_clone_preferences");
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<Record<PreferenceKey, boolean>>;
    return { ...DEFAULT_PREFERENCES, ...parsed };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export default function SettingsPage() {
  const { user, refreshUser, logout } = useAuth();
  const { toast } = useToast();
  const [displayName, setDisplayName] = useState(user?.display_name || "");
  const [about, setAbout] = useState(user?.about || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [preferences, setPreferences] = useState<Record<PreferenceKey, boolean>>(getStoredPreferences);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const nextPreferences = { ...preferences, darkMode: true };
    window.localStorage.setItem("signal_clone_preferences", JSON.stringify(nextPreferences));
    document.documentElement.setAttribute("data-theme", "dark");
  }, [preferences]);

  function togglePreference(key: PreferenceKey) {
    const nextVal = !preferences[key];
    setPreferences((prev) => ({ ...prev, [key]: nextVal }));
    const row = PREFERENCE_ROWS.find((r) => r.key === key);
    if (row && key !== "notifications") {
      toast(`${row.label} ${nextVal ? "enabled" : "disabled"}`, "info");
    }
  }

  async function handleSave() {
    setBusy(true);
    setError(null);
    try {
      await api.updateProfile({ display_name: displayName.trim(), about: about.trim() });
      await refreshUser();
      toast("Profile updated successfully!", "success");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update profile");
    } finally {
      setBusy(false);
    }
  }

  async function handleAvatarUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const token = getToken();
      const res = await fetch(`${API_URL}/api/upload/avatar`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      await refreshUser();
      toast("Avatar updated!", "success");
    } catch {
      toast("Failed to upload avatar", "error");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleAvatarRemove() {
    setUploading(true);
    try {
      await api.updateProfile({ avatar_url: null });
      await refreshUser();
      toast("Profile photo removed", "success");
    } catch {
      toast("Failed to remove profile photo", "error");
    } finally {
      setUploading(false);
    }
  }

  if (!user) return null;

  // Shared card class
  const card = "rounded-2xl border border-[#252c44] bg-[#181d30] p-5 shadow-sm";
  const inputCls =
    "w-full rounded-xl border border-[#252c44] bg-[#1e2236] px-3.5 py-2.5 text-sm text-gray-100 outline-none placeholder-gray-500 focus:border-[#00c8d0] transition";

  return (
    <div className="flex h-full flex-1 flex-col overflow-y-auto bg-[#141828]">
      {/* Header */}
      <div className="flex h-[64px] shrink-0 items-center border-b border-[#252c44] bg-[#181d30] px-5 shadow-sm">
        <h1 className="text-base font-extrabold text-gray-100 tracking-tight leading-none">Settings</h1>
      </div>

      <div className="mx-auto w-full max-w-lg px-4 py-6 space-y-5">

        {/* Avatar Section */}
        <div className={`${card} flex flex-col items-center gap-4`}>
          <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
            <Avatar name={user.display_name} src={user.avatar_url} size={88} />
            <div className="absolute inset-0 flex flex-col items-center justify-center rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition">
              <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              </svg>
              <span className="text-[10px] font-medium mt-1">{uploading ? "Uploading…" : "Change"}</span>
            </div>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
          <div className="text-center">
            <h2 className="text-lg font-bold text-gray-100">{user.display_name}</h2>
            <p className="text-sm font-medium text-[#00c8d0] mt-0.5">
              {user.username ? `@${user.username}` : user.phone_number}
            </p>
            {user.about && <p className="text-xs text-[#8892b0] mt-1">{user.about}</p>}
          </div>
          <div className="flex gap-2">
            <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="rounded-full border border-[#252c44] bg-[#1e2236] px-4 py-1.5 text-xs font-semibold text-[#00c8d0] hover:bg-[#252c44] transition cursor-pointer disabled:opacity-50">
              {uploading ? "Uploading…" : "Update Photo"}
            </button>
            <button onClick={handleAvatarRemove} disabled={uploading || !user.avatar_url} className="rounded-full border border-red-700/40 bg-[#1e2236] px-4 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-900/20 transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-40">
              Remove
            </button>
          </div>
        </div>

        {/* Profile Info */}
        <div className={card}>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#8892b0] mb-4">Profile Information</p>
          <div className="space-y-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-gray-300">Display Name</span>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className={inputCls}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-gray-300">About</span>
              <input
                value={about}
                onChange={(e) => setAbout(e.target.value)}
                placeholder="Tell people about yourself…"
                className={inputCls}
              />
            </label>
            {error && <p className="text-xs text-red-400 font-semibold">{error}</p>}
            <button
              onClick={handleSave}
              disabled={busy}
              className="rounded-xl px-6 py-2.5 text-sm font-bold text-[#0d1117] transition cursor-pointer disabled:opacity-50"
              style={{
                background: busy
                  ? "#1e2236"
                  : "linear-gradient(90deg, #00b8c8, #00c8d0)",
                color: busy ? "#4a5580" : "#0d1117",
              }}
            >
              {busy ? "Saving…" : "Save Profile"}
            </button>
          </div>
        </div>

        {/* Preferences */}
        <div className={card}>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#8892b0] mb-3">Preferences</p>
          <div className="divide-y divide-[#252c44]">
            {PREFERENCE_ROWS.map((row) => (
              <div key={row.key} className="flex items-center gap-3 py-3.5">
                <span className="w-7 text-center text-base text-[#8892b0]">{row.icon}</span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-100">{row.label}</p>
                  <p className="text-xs text-[#8892b0]">{row.desc}</p>
                </div>
                <button
                  type="button"
                  onClick={() => togglePreference(row.key)}
                  className={`relative h-6 w-11 rounded-full transition-colors cursor-pointer ${
                    preferences[row.key] ? "bg-[#00c8d0]" : "bg-[#252c44]"
                  }`}
                >
                  <span
                    className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform ${
                      preferences[row.key] ? "left-6" : "left-1"
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Logout */}
        <div>
          <button
            type="button"
            onClick={() => logout()}
            className="w-full rounded-xl border border-red-700/40 bg-[#181d30] px-4 py-3.5 text-sm font-bold text-red-400 transition hover:bg-red-900/20 hover:border-red-600/60 cursor-pointer"
          >
            Log Out
          </button>
        </div>

        {/* Version footer */}
        <p className="text-center text-[11px] text-[#4a5580] pb-2">Signal Clone v1.0 · Phase 1</p>
      </div>
    </div>
  );
}
