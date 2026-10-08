import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { lobby } from "@/lib/duels/service";
import { DuelLobby } from "@/components/duels/DuelLobby";

export const metadata: Metadata = { title: "Дуэли" };

export default async function DuelsPage() {
  const user = await requireUser();
  const data = await lobby(user.id);
  return <DuelLobby initial={data} me={user.id} />;
}
