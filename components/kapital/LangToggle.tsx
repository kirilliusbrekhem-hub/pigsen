"use client";
import { useRouter } from "next/navigation";
import { LANG_COOKIE, type Lang } from "@/lib/kapital/i18n";

export function setLangCookie(l: Lang) {
  document.cookie = `${LANG_COOKIE}=${l}; Max-Age=${365 * 86400}; Path=/; SameSite=Lax`;
}

/** RU/EN switch. Stores the choice in a cookie; server pages re-render with router.refresh(). */
export function LangToggle({ lang, onChange, small = false, label = "Язык" }: { lang: Lang; onChange?: (l: Lang) => void; small?: boolean; label?: string }) {
  const router = useRouter();
  const pick = (l: Lang) => {
    if (l === lang) return;
    setLangCookie(l);
    if (onChange) onChange(l);
    else router.refresh();
  };
  return (
    <div role="group" aria-label={label} className={`k-seg ${small ? "sm" : ""}`}>
      <button type="button" aria-pressed={lang === "ru"} onClick={() => pick("ru")}>RU</button>
      <button type="button" aria-pressed={lang === "en"} onClick={() => pick("en")}>EN</button>
    </div>
  );
}
