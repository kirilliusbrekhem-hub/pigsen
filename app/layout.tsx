import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Analytics } from "@/components/analytics/Analytics";
import { ToastProvider } from "@/components/ui/Toast";
import "./globals.css";
import "./styles/growth.css";
import "./styles/social.css";
import "./styles/cosmetics.css";
import "./styles/savings-push.css";
import "./styles/landing.css";
import "./styles/nav.css";
import "./styles/fx.css";
import "./styles/duels.css";
import "./styles/analyze.css";
import "./styles/sim.css";
import "./styles/bizplan.css";
import "./styles/biz.css";
import "./styles/proof.css";

export const metadata: Metadata = {
  title: { default: "PìgBiz", template: "%s · PìgBiz" },
  description: "PìgBiz — AI-платформа для изучения бизнеса, предпринимательства, финансов и технологий. Make your money Smarter.",
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

// The theme is applied before first paint from the copy the app layout keeps in localStorage, so this layout
// reads no cookies and public pages (/, /login, legal) can be prerendered. The app layout re-applies the saved
// profile theme on every app page (components/layout/ThemeScript).
const THEME_BOOT = `try{var t=localStorage.getItem("pigsen-theme");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body>
        <ToastProvider>{children}</ToastProvider>
        <Analytics />
      </body>
    </html>
  );
}
