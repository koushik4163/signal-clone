function parseUtcDate(iso: string): Date {
  let s = iso.trim();
  if (s && !s.endsWith("Z") && !s.includes("+") && !s.includes("-", 10)) {
    s += "Z";
  }
  return new Date(s);
}

export function formatMessageTime(iso: string): string {
  if (!iso) return "";
  const d = parseUtcDate(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function formatConversationTime(iso: string | null): string {
  if (!iso) return "";
  const d = parseUtcDate(iso);
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";

  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: "short" });

  return d.toLocaleDateString([], { day: "2-digit", month: "short" });
}

export function formatLastSeen(iso: string | null): string {
  if (!iso) return "offline";
  const d = parseUtcDate(iso);
  if (isNaN(d.getTime())) return "offline";
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  if (diffMs <= 0) return "last seen just now";
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "last seen just now";
  if (diffMin < 60) return `last seen ${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `last seen ${diffHr} hr ago`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays === 1) return "last seen yesterday";
  if (diffDays < 7) return `last seen ${diffDays} days ago`;
  return `last seen ${d.toLocaleDateString([], { day: "2-digit", month: "short" })}`;
}

export function initials(name: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
