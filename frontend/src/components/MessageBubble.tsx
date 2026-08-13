import type { Message } from "@/lib/types";
import { formatMessageTime } from "@/lib/format";

const SENDER_COLORS = [
  "#2563eb", "#d97706", "#059669", "#db2777",
  "#7c3aed", "#0891b2", "#dc2626", "#65a30d",
];

function colorForSender(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return SENDER_COLORS[Math.abs(hash) % SENDER_COLORS.length];
}

function StatusTicks({ status }: { status: Message["status"] }) {
  if (status === "sending") {
    return <span className="text-[11px] text-blue-200">⏱</span>;
  }
  const color = status === "read" ? "#ffffff" : "#bfdbfe";
  const double = status === "delivered" || status === "read";
  return (
    <svg width="16" height="11" viewBox="0 0 16 11" fill="none" className="shrink-0">
      <path
        d="M1 5.5L4 8.5L9 2.5"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {double && (
        <path
          d="M6 5.5L9 8.5L15 1.5"
          stroke={color}
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

export default function MessageBubble({
  message,
  isOwn,
  senderName,
  showSenderName,
  replyToMessage,
  onReply,
}: {
  message: Message;
  isOwn: boolean;
  senderName?: string;
  showSenderName?: boolean;
  replyToMessage?: { senderName?: string; content: string } | null;
  onReply?: () => void;
}) {
  return (
    <div className={`flex ${isOwn ? "justify-end" : "justify-start"} px-2 py-0.5`}>
      <div
        className={`max-w-[75%] md:max-w-[65%] rounded-2xl px-4 py-2.5 shadow-xs ${
          isOwn
            ? "rounded-br-xs bg-[#2c6bed] text-white shadow-sm"
            : "rounded-bl-xs border border-[var(--border-color)] bg-[var(--panel-bg)] text-[var(--foreground)] shadow-xs"
        }`}
      >
        {showSenderName && !isOwn && senderName && (
          <p className="mb-0.5 text-xs font-bold" style={{ color: colorForSender(senderName) }}>
            {senderName}
          </p>
        )}

        {replyToMessage && (
          <div className={`mb-2 rounded-xl border px-2.5 py-1.5 text-[11px] ${
            isOwn
              ? "border-blue-200 bg-blue-500/15 text-blue-50"
              : "border-[var(--border-color)] bg-[var(--panel-alt)] text-[var(--muted)]"
          }`}>
            <p className="font-semibold truncate">{replyToMessage.senderName ? `Replying to ${replyToMessage.senderName}` : "Reply"}</p>
            <p className="mt-0.5 truncate whitespace-pre-wrap break-words">{replyToMessage.content}</p>
          </div>
        )}

        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message.content}</p>

        <div className="mt-1 flex items-center justify-end gap-1.5">
          {onReply && (
            <button
              type="button"
              onClick={onReply}
              className={`text-[10px] underline-offset-2 hover:underline ${isOwn ? "text-blue-100" : "text-[var(--muted)]"}`}
            >
              Reply
            </button>
          )}
          <span className={`text-[10px] font-medium ${isOwn ? "text-blue-100" : "text-[var(--muted)]"}`}>
            {formatMessageTime(message.created_at)}
          </span>
          {isOwn && <StatusTicks status={message.status} />}
        </div>
      </div>
    </div>
  );
}
