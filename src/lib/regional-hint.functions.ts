import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, setResponseHeader } from "@tanstack/react-start/server";
import { parseVercelRegion, type RegionalSuggestion } from "./regional-suggestion";

/** Request-scoped Vercel IP geolocation. Return city/UF only.
 * No raw IP, precise coordinates, operator, postcode or database write.
 */
export const getRegionalHint = createServerFn({ method: "GET" })
  .handler(async (): Promise<RegionalSuggestion | null> => {
    setResponseHeader("Cache-Control", "private, no-store");
    return parseVercelRegion({
      country: getRequestHeader("x-vercel-ip-country") ?? null,
      state: getRequestHeader("x-vercel-ip-country-region") ?? null,
      city: getRequestHeader("x-vercel-ip-city") ?? null,
    });
  });
