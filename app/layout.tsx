import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Onest, Playfair_Display } from "next/font/google";
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
import "./styles/kapital.css";

// Kapital brand fonts (both cover Cyrillic): Playfair Display for headlines and numbers, Onest for text.
const playfair = Playfair_Display({ subsets: ["latin", "cyrillic"], weight: ["600", "700", "800"], style: ["normal", "italic"], variable: "--font-playfair", display: "swap" });
const onest = Onest({ subsets: ["latin", "cyrillic"], weight: ["400", "500", "600", "700"], variable: "--font-onest", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Kapital", template: "%s · Kapital" },
  description: "Kapital — Savings that start businesses. Опиши идею, и ИИ соберёт бизнес, который растёт от твоих реальных накоплений.",
  icons: { icon: "/icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#050A07" },
    { media: "(prefers-color-scheme: dark)", color: "#050A07" },
  ],
};

// The theme is applied before first paint from the copy the app layout keeps in localStorage, so this layout
// reads no cookies and public pages (/, /login, legal) can be prerendered. The app layout re-applies the saved
// profile theme on every app page (components/layout/ThemeScript).
const THEME_BOOT = `try{var t=localStorage.getItem("pigsen-theme");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning className={`${GeistSans.variable} ${GeistMono.variable} ${playfair.variable} ${onest.variable}`}>
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
