import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { AIProviderError, type AIProvider, type StreamRequest } from "../types";

const DEFAULT_MODEL = "claude-opus-5-5";

export function createAnthropicProvider(apiKey: string): AIProvider {
  const client = new Anthropic({ apiKey, maxRetries: 2, timeout: 120_000 });
  const model = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;

  return {
    id: "anthropic",
    label: "Claude",
    isMock: false,
    async *stream({ system, messages, signal }: StreamRequest) {
      try {
        // Server-side refusal fallback: if the model declines, the API reroutes the same request.
        const stream = client.beta.messages.stream(
          {
            model,
            betas: ["server-side-fallback-2026-07-01"],
            fallbacks: "default",
            max_tokens: 8000,
            system,
            output_config: { effort: "medium" },
            messages: messages.map((m) => ({ role: m.role, content: m.content })),
          },
          { signal },
        );
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") yield event.delta.text;
        }
        const final = await stream.finalMessage();
        if (final.stop_reason === "refusal") {
          yield "\n\n_$PIG не может ответить на этот запрос. Попробуйте переформулировать вопрос._";
        } else if (final.stop_reason === "max_tokens") {
          yield "\n\n_Ответ получился длинным и был обрезан. Попросите продолжить._";
        }
      } catch (err) {
        if (err instanceof Anthropic.APIUserAbortError) return;
        if (err instanceof Anthropic.RateLimitError) {
          throw new AIProviderError(err.message, "$PIG сейчас перегружен. Попробуйте через минуту.");
        }
        if (err instanceof Anthropic.AuthenticationError) {
          throw new AIProviderError(err.message, "Ключ AI-провайдера недействителен. Проверьте ANTHROPIC_API_KEY.");
        }
        if (err instanceof Anthropic.APIError) {
          throw new AIProviderError(err.message, "AI-провайдер вернул ошибку. Попробуйте ещё раз.");
        }
        throw err;
      }
    },
  };
}
