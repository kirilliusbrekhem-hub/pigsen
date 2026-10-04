import "server-only";
import { createAnthropicProvider } from "./providers/anthropic";
import { createGeminiProvider } from "./providers/gemini";
import { mockProvider } from "./providers/mock";
import { buildSystemPrompt } from "./prompts";
import type { AIContext, AIProvider, ChatTurn } from "./types";

let cached: AIProvider | null = null;

/** Picks the provider from the environment. API keys never leave the server. */
export function getAIProvider(): AIProvider {
  if (cached) return cached;
  // First configured key wins: Gemini, then Anthropic, otherwise the labeled demo provider.
  const gemini = process.env.GEMINI_API_KEY?.trim();
  const anthropic = process.env.ANTHROPIC_API_KEY?.trim();
  cached = gemini ? createGeminiProvider(gemini) : anthropic ? createAnthropicProvider(anthropic) : mockProvider;
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

/**
 * One-shot structured answer: asks the real provider for JSON and validates it with `parse`.
 * Returns null in demo mode or when the model's output doesn't validate, so callers fall back to rule-based results.
 */
export async function completeJson<T>(system: string, prompt: string, parse: (raw: unknown) => T | null): Promise<T | null> {
  const provider = getAIProvider();
  if (provider.isMock) return null;
  let text = "";
  try {
    const ctx: AIContext = { userName: "", tone: "concise", interests: [], learningSummary: "", related: [] };
    for await (const chunk of provider.stream({ system, messages: [{ role: "user", content: prompt }], context: ctx })) {
      text += chunk;
      if (text.length > 20_000) break;
    }
  } catch (err) {
    console.error("[ai] completeJson failed", err instanceof Error ? err.message : err);
    return null;
  }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return parse(JSON.parse(text.slice(start, end + 1)));
  } catch {
    return null;
  }
}
