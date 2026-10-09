import type { AiTone } from "@/types";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface RelatedMaterial {
  title: string;
  type: string;
  description: string;
  href: string;
}

/** Everything $PIG knows about the user for one reply. Built server-side only. */
export interface AIContext {
  userName: string;
  tone: AiTone;
  interests: string[];
  learningSummary: string;
  /** The user's savings goals, so $PIG can coach with real numbers. */
  savingsSummary?: string;
  related: RelatedMaterial[];
  /** "edu" (Free): educational assistant. "partner" (Pro): business partner persona. Defaults to "edu". */
  mode?: "edu" | "partner";
}

export interface StreamRequest {
  system: string;
  messages: ChatTurn[];
  context: AIContext;
  signal?: AbortSignal;
}

/** A provider streams plain-text (markdown) chunks. Implementations live in ./providers. */
export interface AIProvider {
  id: string;
  label: string;
  isMock: boolean;
  stream(req: StreamRequest): AsyncIterable<string>;
}

export class AIProviderError extends Error {
  constructor(message: string, public userMessage: string) {
    super(message);
  }
}
