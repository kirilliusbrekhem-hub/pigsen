import "server-only";
import { createAnthropicProvider } from "./providers/anthropic";
import { mockProvider } from "./providers/mock";
import { buildSystemPrompt } from "./prompts";
import type { AIContext, AIProvider, ChatTurn } from "./types";

let cached: AIProvider | null = null;

/** Picks the provider from the environment. API keys never leave the server. */
export function getAIProvider(): AIProvider {
  if (cached) return cached;
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  cached = key ? createAnthropicProvider(key) : mockProvider;
  return cached;
}

export const MAX_HISTORY_TURNS = 20;

/** Streams $PIG's reply for a conversation history. UI and routes never talk to providers directly. */
export function streamReply(history: ChatTurn[], context: AIContext, signal?: AbortSignal): AsyncIterable<string> {
  const provider = getAIProvider();
  const messages = history.slice(-MAX_HISTORY_TURNS);
  // The API requires the first turn to be from the user.
  while (messages.length && messages[0].role !== "user") messages.shift();
  return provider.stream({ system: buildSystemPrompt(context), messages, context, signal });
}

/** Short conversation title from the first question. */
export function titleFromQuestion(q: string): string {
  const clean = q.replace(/\s+/g, " ").trim();
  return clean.length > 60 ? `${clean.slice(0, 57).trimEnd()}…` : clean;
}
