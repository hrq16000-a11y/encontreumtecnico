import { useEffect, useRef, useState } from "react";
import { locateCustomerFromDevice, type CustomerArea } from "@/lib/customer-location";

export function CustomerLocationButton({
  onLocated, autoIfGranted = true,
}: {
  onLocated: (area: CustomerArea, source: "manual" | "automatic") => void;
  autoIfGranted?: boolean;
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
      setFound(area);
      setFeedback("Região aproximada preenchida. Confira cidade e bairro antes de continuar.");
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
          {loading ? "Identificando sua região…" : "Usar minha localização"}
        </button>
        {found && <span className="font-medium text-foreground">
          {found.city}/{found.uf}{found.neighborhood ? " · " + found.neighborhood : ""}
        </span>}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Com sua permissão, o GPS identifica a região. A consulta é feita diretamente
        pelo seu dispositivo à BigDataCloud, que recebe suas coordenadas e IP.
        O portal utiliza apenas cidade, UF e bairro aproximado para busca;
        não grava o GPS nem envia seu endereço exato ao técnico.
      </p>
      {feedback && <p className="mt-2 text-xs text-foreground" role="status">{feedback}</p>}
    </div>
  );
}
