import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { WsProvider } from "@/lib/ws-context";
import { ToastProvider } from "@/components/Toast";

export const metadata: Metadata = {
  title: "Signal Clone",
  description: "A Signal-inspired secure messaging platform",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const themeScript = `
    (function() {
      try {
        const stored = JSON.parse(localStorage.getItem('signal_clone_preferences') || '{}');
        const dark = stored.darkMode !== false;
        document.documentElement.classList.toggle('dark', dark);
        document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
      } catch {
        document.documentElement.classList.add('dark');
        document.documentElement.setAttribute('data-theme', 'dark');
      }
    })();
  `;

  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col font-sans" suppressHydrationWarning>
        <AuthProvider>
          <WsProvider>
            <ToastProvider>{children}</ToastProvider>
          </WsProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
