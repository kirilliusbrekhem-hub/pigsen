import "server-only";
import { AIProviderError, type AIProvider, type StreamRequest } from "../types";

// YandexGPT (Yandex Cloud Foundation Models) over REST, no SDK dependency.
// Lite model first (cheaper, faster); if it is rate-limited or unavailable, try the full model.
const DEFAULT_MODELS = ["yandexgpt-lite/latest", "yandexgpt/latest"];
const URL = "https://llm.api.cloud.yandex.net/foundationModels/v1/completion";

interface YandexChunk {
  result?: { alternatives?: Array<{ message?: { text?: string }; status?: string }> };
  error?: { message?: string; grpcCode?: number; httpCode?: number };
}

export function createYandexProvider(apiKey: string, folderId: string): AIProvider {
  const models = [...new Set([process.env.YANDEX_MODEL?.trim(), ...DEFAULT_MODELS].filter((m): m is string => !!m))];

  return {
    id: "yandex",
    label: "YandexGPT",
    isMock: false,
    async *stream({ system, messages, signal }: StreamRequest) {
      let res!: Response;
      outer: for (const model of models) {
        for (let attempt = 0; attempt < 2; attempt++) {
          if (attempt) await new Promise((r) => setTimeout(r, 1000));
          if (signal?.aborted) return;
          try {
            res = await fetch(URL, {
              method: "POST",
              headers: { "content-type": "application/json", authorization: `Api-Key ${apiKey}`, "x-folder-id": folderId },
              body: JSON.stringify({
                modelUri: `gpt://${folderId}/${model}`,
                completionOptions: { stream: true, temperature: 0.5, maxTokens: "4000" },
                messages: [{ role: "system", text: system }, ...messages.map((m) => ({ role: m.role, text: m.content }))],
              }),
              signal,
            });
          } catch (err) {
            if (signal?.aborted) return;
            throw new AIProviderError(String(err), "Не удалось связаться с YandexGPT. Попробуйте ещё раз.");
          }
          if (res.ok) break outer;
          if (res.status === 404 || res.status === 403) break; // model not available for this folder: next one
          if (res.status !== 429 && res.status < 500) break outer; // real error (bad key, folder): report it
        }
      }

      if (!res.ok || !res.body) {
        const detail = await res.text().catch(() => "");
        let reason = String(res.status);
        try {
          const e = (JSON.parse(detail) as YandexChunk).error;
          if (e?.message) reason = `${res.status}: ${e.message.slice(0, 160)}`;
        } catch {
          /* non-JSON body */
        }
        if (res.status === 401) throw new AIProviderError(detail, `YandexGPT не принял ключ (${reason}). Проверьте YANDEX_API_KEY и роль ai.languageModels.user.`);
        if (res.status === 429 || res.status >= 500) throw new AIProviderError(detail, `CAP сейчас перегружен (${reason}). Попробуйте через минуту.`);
        throw new AIProviderError(`${res.status} ${detail}`, `YandexGPT вернул ошибку (${reason}).`);
      }

      // The stream is newline-delimited JSON; every chunk carries the full text so far, so emit only the new tail.
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buf = "";
      let sent = "";
      let status: string | undefined;
      const handle = (line: string): string => {
        if (!line.trim()) return "";
        const chunk = JSON.parse(line) as YandexChunk;
        if (chunk.error) throw new AIProviderError(JSON.stringify(chunk.error), `YandexGPT вернул ошибку (${chunk.error.message ?? "unknown"}).`);
        const alt = chunk.result?.alternatives?.[0];
        status = alt?.status ?? status;
        const text = alt?.message?.text ?? "";
        const delta = text.startsWith(sent) ? text.slice(sent.length) : text;
        sent = text;
        return delta;
      };
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += value;
          let nl: number;
          while ((nl = buf.indexOf("\n")) >= 0) {
            const delta = handle(buf.slice(0, nl));
            buf = buf.slice(nl + 1);
            if (delta) yield delta;
          }
        }
        const tail = handle(buf);
        if (tail) yield tail;
      } catch (err) {
        if (signal?.aborted) return;
        throw err;
      }

      if (status === "ALTERNATIVE_STATUS_CONTENT_FILTER") {
        yield "\n\n_CAP не может ответить на этот запрос. Попробуйте переформулировать вопрос._";
      } else if (status === "ALTERNATIVE_STATUS_TRUNCATED_FINAL") {
        yield "\n\n_Ответ получился длинным и был обрезан. Попросите продолжить._";
      }
    },
  };
}
