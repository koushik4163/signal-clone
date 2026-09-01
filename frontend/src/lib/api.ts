import type { Contact, Conversation, Message, User } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function clearStaleSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("signal_clone_token");
  sessionStorage.removeItem("signal_clone_session_token");
  if (window.location.pathname !== "/login") {
    window.location.replace("/login");
  }
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("signal_clone_token") || sessionStorage.getItem("signal_clone_session_token");
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...options, headers });
  } catch {
    throw new ApiError(0, "Unable to connect to Signal server. Please check your backend connection.");
  }

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || detail;
    } catch {
      // ignore
    }
    if (res.status === 401 && /session token|session expired|authorization/i.test(detail)) {
      clearStaleSession();
      return new Promise<T>(() => {});
    }
    throw new ApiError(res.status, detail);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  // --- auth ---
  signup: (payload: {
    username: string;
    password: string;
    display_name: string;
    email: string;
    phone_number: string;
  }) =>
    request<{ token: string; user: User }>("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  login: (payload: { username: string; password: string }) =>
    request<{ token: string; user: User }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getMe: () => request<User>("/api/auth/me"),

  logout: () => request<{ message: string }>("/api/auth/logout", { method: "POST" }),

  updateProfile: (payload: Partial<Pick<User, "display_name" | "username" | "avatar_url" | "about">>) =>
    request<User>("/api/users/me", { method: "PUT", body: JSON.stringify(payload) }),

  searchUsers: (q: string) => request<User[]>(`/api/users/search?q=${encodeURIComponent(q)}`),

  // --- contacts ---
  listContacts: () => request<Contact[]>("/api/contacts"),

  addContact: (payload: { phone_number?: string; username?: string; nickname?: string }) =>
    request<Contact>("/api/contacts", { method: "POST", body: JSON.stringify(payload) }),

  removeContact: (contactId: string) =>
    request<{ message: string }>(`/api/contacts/${contactId}`, { method: "DELETE" }),

  // --- conversations ---
  listConversations: () => request<Conversation[]>("/api/conversations"),

  getConversation: (id: string) => request<Conversation>(`/api/conversations/${id}`),

  createDirectConversation: (user_id: string) =>
    request<Conversation>("/api/conversations/direct", {
      method: "POST",
      body: JSON.stringify({ user_id }),
    }),

  createGroupConversation: (payload: { name: string; member_ids: string[]; avatar_url?: string }) =>
    request<Conversation>("/api/conversations/group", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  addGroupMember: (conversationId: string, user_id: string) =>
    request<Conversation>(`/api/conversations/${conversationId}/members`, {
      method: "POST",
      body: JSON.stringify({ user_id }),
    }),

  removeGroupMember: (conversationId: string, userId: string) =>
    request<Conversation>(`/api/conversations/${conversationId}/members/${userId}`, {
      method: "DELETE",
    }),

  updateGroup: (conversationId: string, payload: { name: string; avatar_url?: string | null }) =>
    request<Conversation>(`/api/conversations/${conversationId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  markRead: (conversationId: string) =>
    request<{ message: string }>(`/api/conversations/${conversationId}/read`, { method: "POST" }),

  clearConversation: (conversationId: string) =>
    request<{ ok: boolean }>(`/api/conversations/${conversationId}/messages`, { method: "DELETE" }),

  // --- messages ---
  getMessages: (conversationId: string, before?: string, q?: string) => {
    const params = new URLSearchParams();
    if (before) params.set("before", before);
    if (q) params.set("q", q);
    const qs = params.toString();
    return request<Message[]>(
      `/api/conversations/${conversationId}/messages${qs ? `?${qs}` : ""}`
    );
  },

  editMessage: (conversationId: string, messageId: string, content: string) =>
    request<Message>(`/api/conversations/${conversationId}/messages/${messageId}`, {
      method: "PATCH",
      body: JSON.stringify({ content }),
    }),

  deleteMessage: (conversationId: string, messageId: string, forEveryone: boolean) =>
    request<{ ok: boolean }>(
      `/api/conversations/${conversationId}/messages/${messageId}?for_everyone=${forEveryone}`,
      { method: "DELETE" }
    ),

  reactToMessage: (conversationId: string, messageId: string, emoji: string) =>
    request<{ reactions: Record<string, string[]>; added: boolean }>(
      `/api/conversations/${conversationId}/messages/${messageId}/react`,
      { method: "POST", body: JSON.stringify({ emoji }) }
    ),

  togglePin: (conversationId: string, messageId: string) =>
    request<{ pinned: boolean }>(`/api/conversations/${conversationId}/messages/${messageId}/pin`, { method: "POST" }),

  uploadFile: async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    const token = getToken();
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${API_URL}/api/upload/file`, {
      method: "POST",
      headers,
      body: form,
    });
    if (!res.ok) {
      let detail = res.statusText;
      try {
        const body = await res.json();
        detail = body.detail || detail;
      } catch {
        // ignore
      }
      throw new ApiError(res.status, detail);
    }
    const uploaded = await res.json() as { filename: string; content_type: string; url: string };
    return {
      ...uploaded,
      url: uploaded.url.startsWith("http") ? uploaded.url : `${API_URL}${uploaded.url}`,
    };
  },
};

export { ApiError, getToken, API_URL };
