import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { ToastProvider } from "@/components/ui/Toast";
import { getCurrentUser } from "@/lib/auth/session";
import { profileTheme } from "@/lib/profile/service";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "PIGSEN", template: "%s · PIGSEN" },
  description: "PIGSEN — AI-платформа для изучения бизнеса, предпринимательства, финансов и технологий. Make your money Smarter.",
  icons: { icon: "/icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F2F3F0" },
    { media: "(prefers-color-scheme: dark)", color: "#090C0D" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const theme = profileTheme(user?.profile);
  return (
    <html lang="ru" data-theme={theme === "system" ? undefined : theme} className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
