import "server-only";
import { cookies } from "next/headers";
import { isLang, LANG_COOKIE, type Lang } from "./i18n";

/** The visitor's Kapital language (cookie), Russian by default. */
export async function getLang(): Promise<Lang> {
  const v = (await cookies()).get(LANG_COOKIE)?.value;
  return isLang(v) ? v : "ru";
}
