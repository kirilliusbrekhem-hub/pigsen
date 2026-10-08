/** GET when no body is given, POST with a JSON body otherwise. Errors carry the server's Russian message and status. */
export async function call<T>(url: string, body?: unknown): Promise<T> {
  const r = await fetch(url, body === undefined ? { cache: "no-store" } : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error((data as { error?: string }).error ?? "Ошибка"), { status: r.status });
  return data as T;
}
