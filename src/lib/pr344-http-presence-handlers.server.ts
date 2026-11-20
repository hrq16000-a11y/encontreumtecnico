/** PR #344 — isolated HTTP request contract. No production storage is bound. */
export type LeaseOperation = "start" | "beat" | "leave";
export type LeaseResult = "ok" | "rate" | "gone";
export type AdminDecision = "admin" | "forbidden" | "unauthorized";
export interface PresenceHttpServices {
  allowedOrigin: string;
  applyLease(op: LeaseOperation, tabToken: string, request: Request): Promise<LeaseResult>;
  verifyCurrentAdmin(accessToken: string): Promise<AdminDecision>;
  countActive(): Promise<number>;
  now(): Date;
}
const headers = {
  "Cache-Control": "no-store, max-age=0",
  "CDN-Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};
function reply(status: number, data?: { activeConsentedTabs: number; checkedAt: string }): Response {
  return new Response(data ? JSON.stringify(data) : null, {
    status,
    headers: data ? { ...headers, "Content-Type": "application/json; charset=utf-8" } : headers,
  });
}
async function limitedBody(request: Request): Promise<unknown> {
  const length = request.headers.get("content-length");
  if (length && (!/^\d+$/.test(length) || Number(length) > 512)) throw Error("oversize");
  const reader = request.body?.getReader();
  if (!reader) throw Error("empty");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const next = await reader.read();
    if (next.done) break;
    size += next.value.byteLength;
    if (size > 512) {
      await reader.cancel().catch(() => undefined);
      throw Error("oversize");
    }
    chunks.push(next.value);
  }
  if (!size) throw Error("empty");
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}
function exactLease(value: unknown): { op: LeaseOperation; tabToken: string } | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  if (body["op"] !== "start" && body["op"] !== "beat" && body["op"] !== "leave") return null;
  if (typeof body["tabToken"] !== "string" || !/^[0-9a-f]{32}$/.test(body["tabToken"])) return null;
  const keys = Object.keys(body).sort().join(",");
  const required = body["op"] === "leave" ? "op,tabToken" : "consent,op,tabToken";
  if (keys !== required || (body["op"] !== "leave" && body["consent"] !== true)) return null;
  return { op: body["op"], tabToken: body["tabToken"] };
}
export async function postPresenceLease(
  request: Request, services: PresenceHttpServices | null,
): Promise<Response> {
  if (!services) return reply(503);
  if (request.method !== "POST") return reply(405);
  // Explicit configured origin; Host/forwarded headers never establish trust.
  if (!services.allowedOrigin ||
      request.headers.get("origin") !== services.allowedOrigin ||
      new URL(request.url).origin !== services.allowedOrigin ||
      (request.headers.has("sec-fetch-site") && request.headers.get("sec-fetch-site") !== "same-origin")) return reply(403);
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers.get("content-type")?.trim() ?? "")) return reply(400);
  let value: unknown;
  try { value = await limitedBody(request); } catch { return reply(400); }
  const body = exactLease(value);
  if (!body) return reply(400);
  try {
    const result = await services.applyLease(body.op, body.tabToken, request);
    if (result === "ok") return reply(204);
    if (result === "rate") return reply(429);
    if (result === "gone") return reply(410);
  } catch { /* Never log secrets, request payloads or backend errors. */ }
  return reply(503);
}
export async function getAdminPresenceCount(
  request: Request, services: PresenceHttpServices | null,
): Promise<Response> {
  if (!services) return reply(503);
  if (request.method !== "GET") return reply(405);
  const authorization = request.headers.get("authorization") ?? "";
  if (!/^Bearer [^.\s]+\.[^.\s]+\.[^.\s]+$/.test(authorization)) return reply(401);
  try {
    // Auth and CURRENT persisted role must be verified server-side before count.
    const access = await services.verifyCurrentAdmin(authorization.slice(7));
    if (access === "unauthorized") return reply(401);
    if (access === "forbidden") return reply(403);
    if (access !== "admin") return reply(503);
    const count = await services.countActive();
    if (!Number.isSafeInteger(count) || count < 0) return reply(503);
    return reply(200, { activeConsentedTabs: count, checkedAt: services.now().toISOString() });
  } catch { /* Unavailable must never be misreported as zero. */ }
  return reply(503);
}
