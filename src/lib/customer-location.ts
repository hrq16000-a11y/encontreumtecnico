import { BRAZIL_STATES } from "@/lib/service-taxonomy";

// GPS is used only on the visitor's device; coordinates are never persisted,
// logged or attached to a technician request. Only municipality/UF/locality
// explicitly confirmed by the customer may enter search/request fields.
export type CustomerArea = { city: string; uf: string; neighborhood: string };

/** Suggest a service locality, never overwrite a professional's manually
 * selected fields after a previously granted permission auto-detects GPS.
 * Manual clicking allows correction; publishing still requires submit + RPC.
 */
export function suggestTechnicianArea<T extends {
  state_uf: string; city: string; neighborhood: string;
}>(form: T, area: CustomerArea, source: "manual" | "automatic"): T {
  if (source === "automatic" &&
      (form.state_uf || form.city.trim() || form.neighborhood.trim())) return form;
  return { ...form, state_uf: area.uf, city: area.city, neighborhood: area.neighborhood };
}

export function parseBrazilianDeviceLocation(value: unknown): CustomerArea | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  if (item["countryCode"] !== "BR") return null;
  const city = typeof item["city"] === "string" ? item["city"].trim().slice(0, 80) : "";
  const rawState = typeof item["principalSubdivisionCode"] === "string"
    ? item["principalSubdivisionCode"].toUpperCase() : "";
  const uf = rawState.match(/(?:^|-)BR-([A-Z]{2})$/)?.[1] ??
    (BRAZIL_STATES.find((s) => s === rawState) ?? "");
  if (city.length < 2 || !BRAZIL_STATES.some((s) => s === uf)) return null;
  const locality = typeof item["locality"] === "string" ? item["locality"].trim().slice(0, 80) : "";
  const neighborhood = locality && locality.toLocaleLowerCase("pt-BR") !== city.toLocaleLowerCase("pt-BR")
    ? locality : "";
  return { city, uf, neighborhood };
}

export async function locateCustomerFromDevice(): Promise<CustomerArea> {
  // Called ONLY from browser after a click, or after a permission=granted
  // check on a returning visitor. Never attempt an IP-only fallback.
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    throw new Error("O dispositivo não oferece localização. Informe sua cidade manualmente.");
  }
  const position = await new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true, maximumAge: 0, timeout: 10000,
    });
  });
  const lat = position.coords.latitude, lon = position.coords.longitude;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)
      || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    throw new Error("Localização indisponível. Informe a cidade manualmente.");
  }
  // BigDataCloud's free endpoint explicitly permits LIVE device coordinates
  // from client-side JS, with prior user permission. It is NOT server called.
  const url = new URL("https://api.bigdatacloud.net/data/reverse-geocode-client");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lon));
  url.searchParams.set("localityLanguage", "pt");
  let response: Response;
  try {
    response = await fetch(url.toString(), {
      cache: "no-store", signal: AbortSignal.timeout(12000),
    });
  } catch {
    throw new Error("Não foi possível consultar a região. Informe sua cidade manualmente.");
  }
  if (!response.ok) {
    throw new Error("Localização temporariamente indisponível. Informe sua cidade manualmente.");
  }
  const area = parseBrazilianDeviceLocation(await response.json());
  if (!area) {
    throw new Error("Não identificamos uma cidade brasileira com segurança. Informe manualmente.");
  }
  return area;
}
