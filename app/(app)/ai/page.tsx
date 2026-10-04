import type { Metadata } from "next";
import { AIChat } from "@/components/ai/AIChat";
import { requireUser } from "@/lib/auth/session";
import { listConversations } from "@/lib/ai/conversations";

export const metadata: Metadata = { title: "$PIG" };

export default async function AIPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireUser();
  const { q } = await searchParams;
  const conversations = await listConversations(user.id);
  return (
    <AIChat
      key="new"
      conversations={conversations}
      conversationId={null}
      initialMessages={[]}
      initialQuestion={q?.trim() ? q.slice(0, 4000) : null}
      firstName={user.name.split(" ")[0]}
    />
  );
}
