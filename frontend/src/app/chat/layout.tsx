"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { ConversationsProvider } from "@/lib/conversations-context";
import Sidebar from "@/components/Sidebar";

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#141828] text-gray-300">
      <p className="text-[#8892b0] font-medium">Loading...</p>
      </div>
    );
  }

  const isConversationOpen = pathname !== "/chat" && pathname !== "/chat/settings";

  return (
    <ConversationsProvider>
      <div className="flex h-screen w-full overflow-hidden bg-[#141828]">
        <div className={`${isConversationOpen ? "hidden md:flex" : "flex"} w-full md:w-[320px] lg:w-[360px] shrink-0 h-full`}>
          <Sidebar />
        </div>
        <div className={`${isConversationOpen ? "flex" : "hidden md:flex"} flex-1 min-w-0 h-full`}>
          {children}
        </div>
      </div>
    </ConversationsProvider>
  );
}
