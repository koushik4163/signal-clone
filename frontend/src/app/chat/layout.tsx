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
      <div className="flex h-screen items-center justify-center bg-[#edf0f5]">
        <p className="text-gray-600 font-medium">Loading...</p>
      </div>
    );
  }

  // On mobile, show either the sidebar (at /chat) or the open conversation, never both.
  const isConversationOpen = pathname !== "/chat" && pathname !== "/chat/settings";

  return (
    <ConversationsProvider>
      <div className="flex h-screen w-full overflow-hidden">
        <div className={`${isConversationOpen ? "hidden md:flex" : "flex"} w-full md:w-[30%] shrink-0`}>
          <Sidebar />
        </div>
        <div className={`${isConversationOpen ? "flex" : "hidden md:flex"} flex-1 min-w-0`}>{children}</div>
      </div>
    </ConversationsProvider>
  );
}
