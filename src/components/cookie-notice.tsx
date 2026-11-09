import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";

const KEY = "eut-cookie-consent";
type Consent = { necessary: true; functional: boolean; analytics: boolean };

export function CookieNotice() {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(false);
  const [functional, setFunctional] = useState(false);
  const [analytics, setAnalytics] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(KEY)) setOpen(true);
  }, []);

  function save(c: Consent) {
    localStorage.setItem(KEY, JSON.stringify(c));
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div role="dialog" aria-label="Aviso de cookies" className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background p-4 shadow-lg">
      <div className="mx-auto max-w-6xl">
        <p className="text-sm font-semibold text-foreground">Valorizamos sua privacidade</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Utilizamos cookies para aprimorar sua experiência de navegação, exibir conteúdo personalizado e analisar nosso tráfego.
          Ao clicar em “Aceitar todos”, você concorda com nosso uso de cookies.{" "}
          <Link to="/privacidade" className="text-primary underline">Política de privacidade</Link>
        </p>

        {custom && (
          <div className="mt-3 space-y-2 rounded-md border border-border p-3 text-sm">
            <label className="flex items-center gap-2 text-muted-foreground">
              <input type="checkbox" checked disabled /> Necessários (sempre ativos)
            </label>
            <label className="flex items-center gap-2 text-foreground">
              <input type="checkbox" checked={functional} onChange={(e) => setFunctional(e.target.checked)} /> Funcionais
            </label>
            <label className="flex items-center gap-2 text-foreground">
              <input type="checkbox" checked={analytics} onChange={(e) => setAnalytics(e.target.checked)} /> Análise
            </label>
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          {custom ? (
            <button type="button" onClick={() => save({ necessary: true, functional, analytics })}
              className="h-9 rounded-md border border-primary px-4 text-sm font-medium text-primary">
              Salvar minhas preferências
            </button>
          ) : (
            <button type="button" onClick={() => setCustom(true)}
              className="h-9 rounded-md border border-primary px-4 text-sm font-medium text-primary">
              Personalizar
            </button>
          )}
          <button type="button" onClick={() => save({ necessary: true, functional: false, analytics: false })}
            className="h-9 rounded-md border border-primary px-4 text-sm font-medium text-primary">
            Rejeitar
          </button>
          <button type="button" onClick={() => save({ necessary: true, functional: true, analytics: true })}
            className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">
            Aceitar todos
          </button>
        </div>
      </div>
    </div>
  );
}
