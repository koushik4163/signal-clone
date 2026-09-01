"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "./api";
import type { User } from "./types";

interface AuthContextValue {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (token: string, user: User, rememberMe?: boolean) => void;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const TOKEN_KEY = "signal_clone_token";
const SESSION_TOKEN_KEY = "signal_clone_session_token";

function getPersistedToken() {
  if (typeof window === "undefined") return null;
  const saved = localStorage.getItem(TOKEN_KEY);
  if (saved) return saved;
  return sessionStorage.getItem(SESSION_TOKEN_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const stored = getPersistedToken();
    if (!stored) {
      setLoading(false);
      return;
    }
    setToken(stored);
    api
      .getMe()
      .then((u) => setUser(u))
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        sessionStorage.removeItem(SESSION_TOKEN_KEY);
        setToken(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback((newToken: string, newUser: User, rememberMe = false) => {
    if (rememberMe) {
      localStorage.setItem(TOKEN_KEY, newToken);
      sessionStorage.removeItem(SESSION_TOKEN_KEY);
    } else {
      localStorage.removeItem(TOKEN_KEY);
      sessionStorage.setItem(SESSION_TOKEN_KEY, newToken);
    }
    setToken(newToken);
    setUser(newUser);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // ignore network errors on logout
    }
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(SESSION_TOKEN_KEY);
    setToken(null);
    setUser(null);
    router.push("/login");
  }, [router]);

  const refreshUser = useCallback(async () => {
    const u = await api.getMe();
    setUser(u);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
