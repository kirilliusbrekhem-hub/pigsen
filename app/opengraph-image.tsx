import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt = "Kapital — Savings that start businesses.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Kapital tokens (app/styles/kapital.css).
const BG = "#050A07";
const INK = "#EAF2EC";
const INK2 = "#A3B8A9";
const LINE = "#2A4334";
const ACCENT = "#85BB65";

export default async function Image() {
  const fonts = join(process.cwd(), "node_modules/geist/dist/fonts/geist-sans");
  const [medium, regular] = await Promise.all([readFile(join(fonts, "Geist-Medium.ttf")), readFile(join(fonts, "Geist-Regular.ttf"))]);

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "64px 72px", background: BG, color: INK, fontFamily: "Geist", backgroundImage: `radial-gradient(circle at 85% 20%, rgba(133,187,101,.25), transparent 45%)` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ display: "flex", width: 52, height: 52, borderRadius: 99, background: ACCENT, color: "#06120B", alignItems: "center", justifyContent: "center", fontSize: 32, fontWeight: 500 }}>K</div>
          <div style={{ display: "flex", fontSize: 38, fontWeight: 500, letterSpacing: "-0.03em" }}>Kapital</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ display: "flex", fontSize: 86, fontWeight: 500, letterSpacing: "-0.045em", lineHeight: 1 }}>
            Savings that start&nbsp;<span style={{ color: ACCENT }}>businesses.</span>
          </div>
          <div style={{ display: "flex", fontSize: 32, color: INK2, fontWeight: 400, maxWidth: 900, lineHeight: 1.3 }}>Опиши идею, и ИИ соберёт бизнес. Он растёт от твоих реальных накоплений.</div>
        </div>
        <div style={{ display: "flex", gap: 14 }}>
          {["Бизнес за минуту", "Реальные накопления", "Команда", "CAP"].map((t) => (
            <div key={t} style={{ display: "flex", padding: "10px 20px", borderRadius: 99, border: `1px solid ${LINE}`, color: INK, fontSize: 24 }}>
              {t}
            </div>
          ))}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Geist", data: medium, weight: 500, style: "normal" },
        { name: "Geist", data: regular, weight: 400, style: "normal" },
      ],
    },
  );
}
