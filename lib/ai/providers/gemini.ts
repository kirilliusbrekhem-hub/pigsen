import "server-only";
import { AIProviderError, type AIProvider, type StreamRequest } from "../types";

const DEFAULT_MODEL = "gemini-3.8-flash";
const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

interface GeminiChunk {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
}

/** Google Gemini over the REST streaming endpoint (server-sent events), no SDK dependency. */
export function createGeminiProvider(apiKey: string): AIProvider {
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;

  return {
    id: "gemini",
    label: "Gemini",
    isMock: false,
    async *stream({ system, messages, signal }: StreamRequest) {
      let res!: Response;
      // Google returns 503/429 on demand spikes; retry a few times before the stream starts.
      for (let attempt = 0; attempt < 4; attempt++) {
        if (attempt) await new Promise((r) => setTimeout(r, 800 * 2 ** (attempt - 1)));
        if (signal?.aborted) return;
        try {
          res = await fetch(`${BASE}/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-goog-api-key": apiKey,
            },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: system }] },
              contents: messages.map((m) => ({
                role: m.role === "assistant" ? "model" : "user",
                parts: [{ text: m.content }],
              })),
              generationConfig: { maxOutputTokens: 8192 },
            }),
            signal,
          });
        } catch (err) {
          if (signal?.aborted) return;
          throw new AIProviderError(String(err), "Не удалось связаться с AI-провайдером. Попробуйте ещё раз.");
        }
        if (res.status !== 503 && res.status !== 429) break;
      }

      if (!res.ok || !res.body) {
        const detail = await res.text().catch(() => "");
        // Google's error body is {error:{code,status,message}}; surface its short status so the cause is visible.
        let reason = String(res.status);
        try {
          const e = (
            JSON.parse(detail) as {
              error?: { status?: string; message?: string };
            }
          ).error;
          if (e?.status) reason = `${res.status} ${e.status}: ${(e.message ?? "").slice(0, 160)}`;
        } catch {
          /* non-JSON body */
        }
        if (res.status === 429 || res.status === 503) throw new AIProviderError(detail, "$PIG сейчас перегружен. Попробуйте через минуту.");
        throw new AIProviderError(`${res.status} ${detail}`, `Gemini вернул ошибку (${reason}).`);
      }

      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buf = "";
      let finish: string | undefined;
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += value;
          let nl: number;
          while ((nl = buf.indexOf("\n")) >= 0) {
            const line = buf.slice(0, nl).trim();
            buf = buf.slice(nl + 1);
            if (!line.startsWith("data:")) continue;
            const chunk = JSON.parse(line.slice(5)) as GeminiChunk;
            if (chunk.promptFeedback?.blockReason) finish = "SAFETY";
            const cand = chunk.candidates?.[0];
            for (const p of cand?.content?.parts ?? []) if (p.text) yield p.text;
            if (cand?.finishReason) finish = cand.finishReason;
          }
        }
      } catch (err) {
        if (signal?.aborted) return;
        throw err;
      }

      if (finish === "SAFETY" || finish === "PROHIBITED_CONTENT") {
        yield "\n\n_$PIG не может ответить на этот запрос. Попробуйте переформулировать вопрос._";
      } else if (finish === "MAX_TOKENS") {
        yield "\n\n_Ответ получился длинным и был обрезан. Попросите продолжить._";
      }
    },
  };
}
