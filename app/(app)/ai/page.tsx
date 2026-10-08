import type { Metadata } from "next";
import { AIChat } from "@/components/ai/AIChat";
import { requireUserWith } from "@/lib/auth/session";
import { usage } from "@/lib/billing/limits";
import { listConversations } from "@/lib/ai/conversations";

export const metadata: Metadata = { title: "$PIG" };

export default async function AIPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const [user, [quota, { q }, conversations]] = await requireUserWith((userId) => Promise.all([usage(userId, "chat"), searchParams, listConversations(userId)]));
  return (
    <AIChat
      key="new"
      conversations={conversations}
      conversationId={null}
      initialMessages={[]}
      initialQuestion={q?.trim() ? q.slice(0, 4000) : null}
      firstName={user.name.split(" ")[0]}
      quota={quota.tier === "pro" ? null : { left: quota.left, limit: quota.limit }}
    />
  );
}
