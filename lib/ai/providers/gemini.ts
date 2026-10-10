import "server-only";
import { AIProviderError, type AIProvider, type StreamRequest } from "../types";

// Lighter model first; if Google doesn't know it (404) or it stays overloaded, fall back to the full model.
// Free-tier quotas are per model, so extra models keep CAP answering when one hits its limit.
const DEFAULT_MODELS = ["gemini-3.8-flash-lite", "gemini-3.8-flash", "gemini-flash-lite-latest", "gemini-flash-latest", "gemini-2.5-flash-lite"];
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
  const models = [...new Set([process.env.GEMINI_MODEL?.trim(), ...DEFAULT_MODELS].filter((m): m is string => !!m))];

  return {
    id: "gemini",
    label: "Gemini",
    isMock: false,
    async *stream({ system, messages, signal }: StreamRequest) {
      let res!: Response;
      // Remember the most telling failure (quota/overload) so a later model's 404 doesn't hide it.
      let busy: { status: number; detail: string } | null = null;
      // Per model: retry Google's 503/429 demand spikes briefly; on 404 (unknown model) or persistent overload try the next model.
      outer: for (const model of models) {
        for (let attempt = 0; attempt < 3; attempt++) {
          if (attempt) await new Promise((r) => setTimeout(r, 800 * 2 ** (attempt - 1)));
          if (signal?.aborted) return;
          try {
            res = await fetch(`${BASE}/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`, {
              method: "POST",
              headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
              body: JSON.stringify({
                systemInstruction: { parts: [{ text: system }] },
                contents: messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
                generationConfig: { maxOutputTokens: 8192 },
              }),
              signal,
            });
          } catch (err) {
            if (signal?.aborted) return;
            throw new AIProviderError(String(err), "Не удалось связаться с AI-провайдером. Попробуйте ещё раз.");
          }
          if (res.ok) break outer;
          if (res.status === 429 || res.status === 503) busy = { status: res.status, detail: await res.clone().text().catch(() => "") };
          if (res.status === 404 || res.status === 400 || res.status === 403) break; // model unavailable for this key: next one
          // Quota exhausted (429 RESOURCE_EXHAUSTED) won't clear in seconds: move on to the next model.
          if (res.status === 429 && attempt >= 1) break;
          if (res.status !== 503 && res.status !== 429) break outer; // real error: report it
        }
      }

      if (!res.ok || !res.body) {
        let status = res.status;
        let detail = await res.text().catch(() => "");
        if (busy && [400, 403, 404].includes(status)) ({ status, detail } = busy);
        // Google's error body is {error:{code,status,message}}; surface its short status so the cause is visible.
        let reason = String(status);
        try {
          const e = (
            JSON.parse(detail) as {
              error?: { status?: string; message?: string };
            }
          ).error;
          if (e?.status) reason = `${status} ${e.status}: ${(e.message ?? "").slice(0, 160)}`;
        } catch {
          /* non-JSON body */
        }
        if (status === 429) throw new AIProviderError(detail, `У ключа Gemini закончился лимит запросов (${reason}). Попробуйте позже или включите оплату в Google AI Studio.`);
        if (status === 503) throw new AIProviderError(detail, `CAP сейчас перегружен (${reason}). Попробуйте через минуту.`);
        throw new AIProviderError(`${status} ${detail}`, `Gemini вернул ошибку (${reason}).`);
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
        yield "\n\n_CAP не может ответить на этот запрос. Попробуйте переформулировать вопрос._";
      } else if (finish === "MAX_TOKENS") {
        yield "\n\n_Ответ получился длинным и был обрезан. Попросите продолжить._";
      }
    },
  };
}
