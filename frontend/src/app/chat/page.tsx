export default function ChatEmptyState() {
  return (
    <div className="flex h-full flex-1 flex-col items-center justify-center gap-5 bg-[#0f1621] text-center p-6 select-none chat-pattern">
      {/* Logo circle */}
      <div
        className="flex h-24 w-24 items-center justify-center rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(0,200,208,0.15) 0%, rgba(0,180,200,0.05) 70%)",
          border: "2px solid rgba(0,200,208,0.3)",
          boxShadow: "0 0 40px rgba(0,200,208,0.15)",
        }}
      >
        <svg width="44" height="44" viewBox="0 0 24 24" fill="#00c8d0">
          <path d="M20 2H4C2.9 2 2 2.9 2 4v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-9 11H7v-2h4v2zm6 0h-4v-2h4v2zm0-4H7V7h10v2z" />
        </svg>
      </div>

      <div>
        <h2 className="text-2xl font-extrabold text-gray-100 tracking-tight">Signal Desktop</h2>
        <p className="max-w-xs text-xs text-[#8892b0] font-normal mt-2 leading-relaxed">
          Send and receive end-to-end encrypted messages seamlessly.
          Select a conversation from the sidebar to get started.
        </p>
      </div>

      <div
        className="flex items-center gap-2 text-[11px] font-semibold text-[#00c8d0] px-5 py-2 rounded-full"
        style={{
          background: "rgba(0,200,208,0.08)",
          border: "1px solid rgba(0,200,208,0.2)",
        }}
      >
        <span>🔒</span>
        <span>End-to-end encrypted</span>
      </div>
    </div>
  );
}
