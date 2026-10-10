import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DescribeFlow } from "@/components/kapital/Describe";
import { requireUser } from "@/lib/auth/session";
import { getLang } from "@/lib/kapital/lang";
import { hasBusiness } from "@/lib/kapital/service";

export const metadata: Metadata = { title: "Опиши свой бизнес" };

export default async function NewBusinessPage() {
  const [user, lang] = await Promise.all([requireUser(), getLang()]);
  if (await hasBusiness(user.id)) redirect("/business");
  return <DescribeFlow lang={lang} initial={(user.name.trim().charAt(0) || "K").toUpperCase()} />;
}
