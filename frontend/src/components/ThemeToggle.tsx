"use client";
import { useEffect, useState } from "react";

function readTheme() {
  if (typeof window === "undefined") return true;
  try {
    const preferences = JSON.parse(window.localStorage.getItem("signal_clone_preferences") || "{}");
    return preferences.darkMode !== false;
  } catch {
    return true;
  }
}

export default function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [darkMode, setDarkMode] = useState(true);

  useEffect(() => {
    const syncTheme = () => {
      const nextDarkMode = readTheme();
      setDarkMode(nextDarkMode);
      document.documentElement.classList.toggle("dark", nextDarkMode);
      document.documentElement.setAttribute("data-theme", nextDarkMode ? "dark" : "light");
    };
    syncTheme();
    window.addEventListener("signal_clone_theme_changed", syncTheme);
    return () => window.removeEventListener("signal_clone_theme_changed", syncTheme);
  }, []);

  function toggleTheme() {
    const nextDarkMode = !darkMode;
    setDarkMode(nextDarkMode);
    document.documentElement.classList.toggle("dark", nextDarkMode);
    document.documentElement.setAttribute("data-theme", nextDarkMode ? "dark" : "light");
    try {
      const preferences = JSON.parse(window.localStorage.getItem("signal_clone_preferences") || "{}");
      window.localStorage.setItem("signal_clone_preferences", JSON.stringify({ ...preferences, darkMode: nextDarkMode }));
    } catch {
      window.localStorage.setItem("signal_clone_preferences", JSON.stringify({ darkMode: nextDarkMode }));
    }
    window.dispatchEvent(new Event("signal_clone_theme_changed"));
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={darkMode ? "Switch to light theme" : "Switch to dark theme"}
      title={darkMode ? "Light theme" : "Dark theme"}
      className={compact
        ? "theme-toggle flex h-9 w-9 items-center justify-center rounded-full border border-transparent text-sm text-[#8892b0] hover:bg-[#252c44] hover:text-white transition cursor-pointer"
        : "theme-toggle flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/20 text-sm text-white backdrop-blur hover:bg-white/10 transition cursor-pointer"}
    >
      {darkMode ? (
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
          <circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      ) : (
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.5 15.2A8.5 8.5 0 1 1 8.8 3.5a6.7 6.7 0 0 0 11.7 11.7Z" fill="currentColor" stroke="none" />
        </svg>
      )}
    </button>
  );
}
