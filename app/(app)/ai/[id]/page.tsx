import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AIChat } from "@/components/ai/AIChat";
import { requireUser } from "@/lib/auth/session";
import { getConversationWithMessages, listConversations } from "@/lib/ai/conversations";

export const metadata: Metadata = { title: "$PIG" };

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const [convo, conversations] = await Promise.all([getConversationWithMessages(user.id, id), listConversations(user.id)]);
  if (!convo) notFound();
  return (
    <AIChat
      key={convo.id}
      conversations={conversations}
      conversationId={convo.id}
      initialMessages={convo.messages.map((m) => ({ ...m, status: "done" as const, mock: m.provider === "Демо-режим" }))}
      initialQuestion={null}
      firstName={user.name.split(" ")[0]}
    />
  );
}
