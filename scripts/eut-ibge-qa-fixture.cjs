/* Read-only mock PostgREST backend for PR #255 browser QA.
 * Loopback only. All identities, municipality samples and catalog data synthetic.
 * No SQL, auth tokens, remote requests or persistent state.
 */
const http = require("node:http");
const assert = require("node:assert/strict");
const PORT = 43831;
const IBGE = [
  { id: 4125506, name: "São José dos Pinhais", uf: "PR", latitude: -25.53, longitude: -49.2 },
  { id: 4106902, name: "Curitiba", uf: "PR", latitude: -25.43, longitude: -49.27 },
];
const categories = [
  { slug: "computadores", label: "Computadores", description: "Suporte a computadores", active: true },
  { slug: "redes", label: "Redes", description: "Redes e Wi-Fi", active: true },
];
const services = [
  { slug: "manutencao-computadores", category_slug: "computadores", label: "Manutenção de computadores", active: true },
  { slug: "wifi", category_slug: "redes", label: "Redes Wi-Fi", active: true },
];
const secret = "qa-secret-never-publish@example.test";
const technicians = Array.from({ length: 180 }, (_, index) => {
  const number = index + 1;
  const computer = index < 150;
  return {
    id: "00000000-0000-4000-8000-" + String(number).padStart(12, "0"),
    public_slug: "qa-profissional-" + String(number).padStart(3, "0"),
    display_name: "Profissional Sintético " + number,
    specialties: [computer ? "computadores" : "redes"],
    service_slugs: [computer ? "manutencao-computadores" : "wifi"],
    city: "Pinhais", state_uf: "PR", neighborhood: "Centro", region: null,
    bio: number === 121 ? secret : "Atendimento profissional declarado",
    avatar_path: null, service_radius_km: null,
    coverage_city_ids: [4125506], status: "aprovado",
    created_at: "2026-01-01T00:00:00Z",
    // Never returned in the projection, even if clients request unexpected fields.
    private_phone: "41999990000", private_note: secret,
  };
});
const eligibleIds = new Set(technicians.slice(120, 175).map(row => row.id));
const onlyRead = new Set(["GET", "HEAD", "OPTIONS", "POST"]);
function respond(res, body, status = 200, moreHeaders = {}) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*", "access-control-allow-headers": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS", "cache-control": "no-store",
    ...moreHeaders });
  res.end(JSON.stringify(body));
}
function selected(rows, url) {
  const projection = url.searchParams.get("select");
  if (!projection || projection === "*") return rows;
  const keys = projection.split(",").filter(key => /^[a-z_]+$/.test(key));
  return rows.map(row => Object.fromEntries(keys.map(key => [key, row[key] ?? null])));
}
function matchEq(url, name, value) {
  const filter = url.searchParams.get(name);
  if (!filter) return true;
  if (filter.startsWith("eq.")) return String(value) === filter.slice(3);
  if (filter.startsWith("in.(") && filter.endsWith(")"))
    return filter.slice(4, -1).split(",").includes(String(value));
  return false;
}
function contains(url, name, values) {
  const filter = url.searchParams.get(name);
  if (!filter) return true;
  if (!filter.startsWith("cs.{") || !filter.endsWith("}")) return false;
  return filter.slice(4, -1).split(",").filter(Boolean).every(value =>
    values.map(String).includes(value));
}
function paginate(req, url, rows) {
  const range = /^(\d+)-(\d+)$/.exec(req.headers.range || "");
  const offset = Number(url.searchParams.get("offset") ?? range?.[1] ?? "0");
  const limit = Number(url.searchParams.get("limit") ?? (range ? Number(range[2]) - Number(range[1]) + 1 : 1000));
  assert(Number.isSafeInteger(offset) && offset >= 0 && Number.isSafeInteger(limit) && limit >= 0);
  return rows.slice(offset, offset + limit);
}
function sendRows(req, res, url, rows) {
  const projected = selected(paginate(req, url, rows), url);
  const object = (req.headers.accept || "").includes("vnd.pgrst.object");
  respond(res, object ? (projected[0] ?? null) : projected);
}
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", "http://127.0.0.1:" + PORT);
    if (url.pathname === "/__health" && req.method === "GET")
      return respond(res, { synthetic: true, backend: "loopback", candidates: 180, eligible: 55 });
    if (!onlyRead.has(req.method)) return respond(res, { error: "write prohibited" }, 405);
    if (req.method === "OPTIONS") return respond(res, {});
    if (req.method === "POST") {
      if (!url.pathname.startsWith("/rest/v1/rpc/")) return respond(res, { error: "write prohibited" }, 405);
      const chunks = []; for await (const chunk of req) chunks.push(chunk);
      const data = JSON.parse(Buffer.concat(chunks).toString() || "{}");
      if (url.pathname === "/rest/v1/rpc/eut_public_eligible_technician_ids") {
        assert(Array.isArray(data._ids) && data._ids.length <= 500);
        return respond(res, data._ids.filter(id => eligibleIds.has(id)).map(technician_id => ({ technician_id })));
      }
      if (url.pathname === "/rest/v1/rpc/eut_online_published_ids") return respond(res, []);
      if (url.pathname === "/rest/v1/rpc/eut_public_referral_highlights") return respond(res, []);
      if (url.pathname === "/rest/v1/rpc/eut_ads_public_slot") return respond(res, null);
      return respond(res, { error: "unknown synthetic RPC" }, 404);
    }
    if (req.method !== "GET") return respond(res, { error: "not allowed" }, 405);
    if (url.pathname === "/rest/v1/eut_ibge_municipalities")
      return sendRows(req, res, url, IBGE.filter(row =>
        matchEq(url, "id", row.id) && matchEq(url, "uf", row.uf)));
    if (url.pathname === "/rest/v1/eut_service_categories")
      return sendRows(req, res, url, categories.filter(row =>
        matchEq(url, "slug", row.slug) && matchEq(url, "active", row.active)));
    if (url.pathname === "/rest/v1/eut_service_types")
      return sendRows(req, res, url, services.filter(row =>
        matchEq(url, "slug", row.slug) && matchEq(url, "active", row.active)));
    if (url.pathname === "/rest/v1/eut_pioneer_badges") return respond(res, []);
    if (url.pathname === "/rest/v1/technicians") {
      const rows = technicians.filter(row =>
        matchEq(url, "status", row.status) &&
        matchEq(url, "state_uf", row.state_uf) &&
        contains(url, "coverage_city_ids", row.coverage_city_ids) &&
        contains(url, "specialties", row.specialties) &&
        contains(url, "service_slugs", row.service_slugs));
      return sendRows(req, res, url, rows);
    }
    return respond(res, { error: "unknown fixture path", path: url.pathname }, 404);
  } catch (error) {
    console.error("Synthetic fixture error:", error.message);
    return respond(res, { error: "invalid fixture request" }, 400);
  }
});
server.listen(PORT, "127.0.0.1", () => {
  console.log("EUT_IBGE_FIXTURE_READY http://127.0.0.1:" + PORT);
});
