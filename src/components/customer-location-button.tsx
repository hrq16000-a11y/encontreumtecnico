import { useEffect, useRef, useState } from "react";
import { locateCustomerFromDevice, type CustomerArea } from "@/lib/customer-location";
import { rememberRegionalHint } from "@/lib/regional-suggestion";

export function CustomerLocationButton({
  onLocated, autoIfGranted = true, purpose = "customer",
}: {
  onLocated: (area: CustomerArea, source: "manual" | "automatic") => void;
  autoIfGranted?: boolean;
  /** Technician suggestions are public only if the professional explicitly publishes. */
  purpose?: "customer" | "technician";
}) {
  const callback = useRef(onLocated);
  callback.current = onLocated;
  const inFlight = useRef(false);
  const mounted = useRef(false);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [found, setFound] = useState<CustomerArea | null>(null);

  async function detect(source: "manual" | "automatic") {
    if (inFlight.current) return;
    inFlight.current = true;
    if (mounted.current) { setLoading(true); setFeedback(""); }
    try {
      const area = await locateCustomerFromDevice();
      if (!mounted.current) return;
      callback.current(area, source);
      // Only existing GPS permission or a user click; store city/UF, no coordinates.
      rememberRegionalHint({ ...area, source: "gps" });
      setFound(area);
      setFeedback(purpose === "technician"
        ? "Município sugerido. Escolha-o na lista oficial e digite seu bairro, se desejar."
        : "Município sugerido. Confira e informe o bairro manualmente, se necessário.");
    } catch {
      if (mounted.current) setFeedback("Localização indisponível ou não autorizada. Você pode informar ou corrigir sua cidade manualmente.");
    } finally {
      inFlight.current = false;
      if (mounted.current) setLoading(false);
    }
  }

  useEffect(() => {
    mounted.current = true;
    let active = true;
    // Already-authorized location is applied automatically. Never open a new
    // permission prompt or send coordinates merely because a page loaded.
    if (autoIfGranted && typeof navigator !== "undefined" && navigator.permissions) {
      void navigator.permissions.query({ name: "geolocation" }).then((permission) => {
        if (active && permission.state === "granted") void detect("automatic");
      }).catch(() => {});
    }
    return () => { active = false; mounted.current = false; };
  }, [autoIfGranted]);

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" disabled={loading} onClick={() => void detect("manual")}
          className="inline-flex min-h-10 items-center gap-2 rounded-md border border-primary px-4 py-2 font-semibold text-primary disabled:opacity-60">
          <span aria-hidden="true">⌖</span>
          {loading ? "Identificando sua região…" :
            purpose === "technician" ? "Sugerir município pelo GPS" : "Usar minha localização"}
        </button>
        {found && <span className="font-medium text-foreground">
          {found.city}/{found.uf}{found.neighborhood ? " · " + found.neighborhood : ""}
        </span>}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Com sua permissão, o dispositivo consulta a BigDataCloud (que recebe coordenadas e IP)
        para sugerir município e UF. Bairro não é identificado com segurança e deve ser informado
        por você. O portal não armazena as coordenadas exatas.
      </p>
      {feedback && <p className="mt-2 text-xs text-foreground" role="status">{feedback}</p>}
    </div>
  );
}
