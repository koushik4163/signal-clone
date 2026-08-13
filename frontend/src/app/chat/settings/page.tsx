"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError, API_URL } from "@/lib/api";
import { useToast } from "@/components/Toast";
import Avatar from "@/components/Avatar";

type PreferenceKey = "notifications" | "readReceipts" | "onlineStatus" | "compactMode" | "darkMode";

const DEFAULT_PREFERENCES: Record<PreferenceKey, boolean> = {
  notifications: true,
  readReceipts: true,
  onlineStatus: true,
  compactMode: false,
  darkMode: false,
};

const PREFERENCE_ROWS: Array<{ key: PreferenceKey; icon: string; label: string; desc: string }> = [
  { key: "notifications", icon: "🔔", label: "Message notifications", desc: "Receive alerts and sounds for new messages" },
  { key: "readReceipts", icon: "✅", label: "Read receipts", desc: "Let contacts see when you have read their messages" },
  { key: "onlineStatus", icon: "🟢", label: "Online status", desc: "Show when you are active and your last seen time" },
  { key: "compactMode", icon: "📱", label: "Compact mode", desc: "Use tighter spacing in conversation list" },
  { key: "darkMode", icon: "🌙", label: "Dark mode", desc: "Turn dark mode on or use light mode instead" },
];

const PLACEHOLDER_FEATURES: Array<{ icon: string; label: string; desc: string; tag: string }> = [
  { icon: "📞", label: "Voice / Video calls", desc: "Coming soon — secure calling flow is still being prepared.", tag: "Coming soon" },
  { icon: "✨", label: "Stories", desc: "Coming soon — share fleeting updates with your contacts.", tag: "Coming soon" },
  { icon: "💻", label: "Linked devices", desc: "Coming soon — multi-device sync and session pairing are planned.", tag: "Coming soon" },
  { icon: "🔒", label: "End-to-end encryption", desc: "Coming soon — encryption is simulated for the demo experience.", tag: "Coming soon" },
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
  const router = useRouter();
  const { toast } = useToast();
  const [displayName, setDisplayName] = useState(user?.display_name || "");
  const [about, setAbout] = useState(user?.about || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [preferences, setPreferences] = useState<Record<PreferenceKey, boolean>>(getStoredPreferences);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    window.localStorage.setItem("signal_clone_preferences", JSON.stringify(preferences));
    document.documentElement.setAttribute("data-theme", preferences.darkMode ? "dark" : "light");
  }, [preferences]);

  function togglePreference(key: PreferenceKey) {
    const nextVal = !preferences[key];
    setPreferences((prev) => ({ ...prev, [key]: nextVal }));
    const row = PREFERENCE_ROWS.find((r) => r.key === key);
    if (row) {
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
      const token = localStorage.getItem("signal_clone_token");
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

  if (!user) return null;

  const displayPhoneNumber = user.phone_number || (user.username ? `@${user.username}` : "Signal User");

  return (
    <div className="flex h-full flex-1 flex-col overflow-y-auto bg-[#edf0f5]">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-3 shadow-xs">
        <button className="text-gray-500 hover:text-gray-800 md:hidden" onClick={() => router.push("/chat")}>
          ←
        </button>
        <h1 className="text-lg font-bold text-gray-900">Settings</h1>
      </div>

      <div className="mx-auto w-full max-w-lg px-4 py-8">
        {/* Avatar Section */}
        <div className="mb-6 flex flex-col items-center gap-3 bg-white p-6 rounded-2xl shadow-xs border border-gray-200">
          <div className="relative group">
            <Avatar name={user.display_name} src={user.avatar_url} size={96} />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="absolute inset-0 flex flex-col items-center justify-center rounded-full bg-black/40 text-white opacity-0 transition group-hover:opacity-100"
            >
              <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              </svg>
              <span className="text-[11px] font-medium mt-1">{uploading ? "Uploading..." : "Change Avatar"}</span>
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarUpload}
            className="hidden"
          />

          <div className="text-center">
            <h2 className="text-lg font-bold text-gray-900">{user.display_name}</h2>
            <p className="text-sm font-medium text-[#2c6bed] mt-0.5">{displayPhoneNumber}</p>
          </div>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="mt-2 rounded-full border border-gray-300 bg-white px-4 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 shadow-xs"
          >
            Upload Avatar
          </button>
        </div>

        {/* Profile Info */}
        <div className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-xs border border-gray-200">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Profile Information</h3>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-gray-700">Display Name</span>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#2c6bed] focus:ring-1 focus:ring-[#2c6bed]"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-gray-700">About</span>
            <input
              value={about}
              onChange={(e) => setAbout(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#2c6bed] focus:ring-1 focus:ring-[#2c6bed]"
            />
          </label>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button
            onClick={handleSave}
            disabled={busy}
            className="self-start rounded-lg bg-[#2c6bed] px-5 py-2 text-sm font-semibold text-white hover:bg-[#1d5bd8] disabled:opacity-50 shadow-xs"
          >
            {busy ? "Saving..." : "Save Profile"}
          </button>
        </div>

        {/* Preferences Toggles */}
        <div className="mt-6 rounded-2xl bg-white p-2 shadow-xs border border-gray-200 divide-y divide-gray-100">
          <div className="px-4 py-3">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Preferences</h3>
          </div>
          {PREFERENCE_ROWS.map((row) => (
            <div key={row.key} className="flex items-center gap-3 px-4 py-3.5">
              <span className="text-lg">{row.icon}</span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-900">{row.label}</p>
                <p className="text-xs text-gray-500">{row.desc}</p>
              </div>
              <button
                type="button"
                onClick={() => togglePreference(row.key)}
                className={`relative h-6 w-11 rounded-full transition-colors ${preferences[row.key] ? "bg-[#2c6bed]" : "bg-gray-300"}`}
              >
                <span
                  className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform ${preferences[row.key] ? "left-6" : "left-1"}`}
                />
              </button>
            </div>
          ))}
        </div>

        {/* Placeholder / mock feature section */}
        <div className="mt-6 rounded-2xl bg-white p-4 shadow-xs border border-gray-200">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Demo features</p>
              <p className="mt-1 text-sm text-gray-500">These items are placeholders for the full Signal-like experience.</p>
            </div>
          </div>

          <div className="space-y-3">
            {PLACEHOLDER_FEATURES.map((feature) => (
              <div key={feature.label} className="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-lg shadow-xs border border-gray-200">
                  {feature.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900">{feature.label}</p>
                    <span className="rounded-full bg-[#eef3ff] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#2c6bed]">
                      {feature.tag}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Logout */}
        <div className="mt-6">
          <button
            type="button"
            onClick={() => logout()}
            className="w-full rounded-xl bg-white border border-red-200 px-4 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-50 shadow-xs"
          >
            Log Out
          </button>
        </div>
      </div>
    </div>
  );
}
