import { initials } from "@/lib/format";

const COLORS = [
  "#3a76f0", "#8b5cf6", "#ec4899", "#f59e0b",
  "#10b981", "#06b6d4", "#ef4444", "#6366f1",
];

function colorForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return COLORS[Math.abs(hash) % COLORS.length];
}

export default function Avatar({
  name,
  src,
  size = 44,
  online,
  showOnlineDot = false,
}: {
  name: string;
  src?: string | null;
  size?: number;
  online?: boolean;
  showOnlineDot?: boolean;
}) {
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={name}
          width={size}
          height={size}
          className="rounded-full object-cover"
          style={{ width: size, height: size }}
        />
      ) : (
        <div
          className="flex items-center justify-center rounded-full font-semibold text-white"
          style={{ width: size, height: size, backgroundColor: colorForName(name), fontSize: size * 0.38 }}
        >
          {initials(name)}
        </div>
      )}
      {showOnlineDot && (
        <span
          className={`absolute bottom-0 right-0 rounded-full border-2 border-[#182230] ${
            online ? "bg-emerald-500" : "bg-slate-500"
          }`}
          style={{ width: size * 0.28, height: size * 0.28 }}
        />
      )}
    </div>
  );
}
