import { parseErrorSignal } from "./error-signal";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
  "Content-Type": "text/plain; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
};

// A bounded process-local rate cap; no client identifiers or tracking state.
let minuteStarted = 0;
let minuteCount = 0;

export async function handleErrorSignal(request: Request): Promise<Response> {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin ||
      request.headers.get("content-type")?.split(";")[0]?.trim() !== "application/json") {
    return new Response(null, { status: 403, headers: NO_STORE_HEADERS });
  }

  const reader = request.body?.getReader();
  if (!reader) return new Response(null, { status: 400, headers: NO_STORE_HEADERS });
  const decoder = new TextDecoder();
  let body = "";
  let bytes = 0;
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    bytes += part.value.byteLength;
    if (bytes > 256) {
      await reader.cancel();
      return new Response(null, { status: 413, headers: NO_STORE_HEADERS });
    }
    body += decoder.decode(part.value, { stream: true });
  }
  body += decoder.decode();
  let input: unknown;
  try {
    input = JSON.parse(body);
  } catch {
    return new Response(null, { status: 400, headers: NO_STORE_HEADERS });
  }
  const signal = parseErrorSignal(input);
  if (!signal) return new Response(null, { status: 400, headers: NO_STORE_HEADERS });

  const now = Date.now();
  if (now - minuteStarted >= 60_000) {
    minuteStarted = now;
    minuteCount = 0;
  }
  if (minuteCount++ < 12) {
    // A first-party, anonymous operational counter in existing server logs.
    // Never log the request, raw error, URL, headers, IP or user identity.
    console.warn("[EUT_ERROR_SIGNAL]", signal.kind, signal.area, signal.status);
  }
  return new Response(null, { status: 204, headers: NO_STORE_HEADERS });
}
