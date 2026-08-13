export default function ChatEmptyState() {
  return (
    <div className="flex h-full flex-1 flex-col items-center justify-center gap-3 bg-[var(--chat-bg)] text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--border-color)] bg-[var(--panel-bg)] text-3xl shadow-xs">
        💬
      </div>
      <p className="text-lg font-bold text-[var(--foreground)]">Select a conversation</p>
      <p className="max-w-xs text-sm font-medium text-[var(--muted)]">
        Choose a chat from the list, or start a new one to begin messaging.
      </p>
    </div>
  );
}
