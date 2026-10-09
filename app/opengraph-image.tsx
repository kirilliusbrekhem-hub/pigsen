import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt = "PìgBiz — Make your money Smarter.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Brand tokens from app/prototype.css (dark AI surface + accent).
const BG = "#0C1114";
const INK = "#EEF1EE";
const INK2 = "#9AA6A1";
const LINE = "#222B2E";
const ACCENT = "#4CC795";

export default async function Image() {
  const fonts = join(process.cwd(), "node_modules/geist/dist/fonts/geist-sans");
  const [medium, regular, pig] = await Promise.all([
    readFile(join(fonts, "Geist-Medium.ttf")),
    readFile(join(fonts, "Geist-Regular.ttf")),
    readFile(join(process.cwd(), "public/pig.png")),
  ]);
  const pigSrc = `data:image/png;base64,${pig.toString("base64")}`;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "64px 72px", background: BG, color: INK, fontFamily: "Geist", backgroundImage: `radial-gradient(circle at 85% 20%, rgba(76,199,149,.28), transparent 45%)` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <img src={pigSrc} width={44} height={50} alt="" style={{ filter: "invert(1)" }} />
          <div style={{ display: "flex", fontSize: 38, fontWeight: 500, letterSpacing: "-0.03em" }}>
            Pìg<span style={{ color: ACCENT }}>Biz</span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ display: "flex", fontSize: 86, fontWeight: 500, letterSpacing: "-0.045em", lineHeight: 1 }}>
            Make your money&nbsp;<span style={{ color: ACCENT }}>Smarter.</span>
          </div>
          <div style={{ display: "flex", fontSize: 32, color: INK2, fontWeight: 400, maxWidth: 900, lineHeight: 1.3 }}>Копи по-настоящему — строй свой бизнес с AI-партнёром $PIG</div>
        </div>
        <div style={{ display: "flex", gap: 14 }}>
          {["Копилка", "Мой бизнес", "Друзья-кофаундеры", "$PIG"].map((t) => (
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
