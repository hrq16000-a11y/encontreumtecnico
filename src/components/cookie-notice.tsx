import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";

const KEY = "eut-cookie-consent";
type Consent = { necessary: true; functional: boolean; analytics: boolean; advertising: boolean; presence: boolean };

export function CookieNotice() {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(false);
  const [functional, setFunctional] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [advertising, setAdvertising] = useState(false);
  const [presence, setPresence] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(KEY)) setOpen(true);
    function reopen() {
      try {
        const saved = JSON.parse(localStorage.getItem(KEY) || "{}") as Partial<Consent>;
        setFunctional(saved.functional === true);
        setAnalytics(saved.analytics === true);
        setAdvertising(saved.advertising === true);
        setPresence(saved.presence === true);
      } catch {
        setFunctional(false);
        setAnalytics(false);
        setAdvertising(false);
        setPresence(false);
      }
      setCustom(true);
      setOpen(true);
    }
    window.addEventListener("eut-open-cookie-preferences", reopen);
    return () => window.removeEventListener("eut-open-cookie-preferences", reopen);
  }, []);

  function save(c: Consent) {
    localStorage.setItem(KEY, JSON.stringify(c));
    window.dispatchEvent(new Event("eut-consent-changed"));
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div role="dialog" aria-label="Aviso de cookies" className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background p-4 shadow-lg">
      <div className="mx-auto max-w-6xl">
        <p className="text-sm font-semibold text-foreground">Valorizamos sua privacidade</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Cookies necessários mantêm as funções essenciais. Opções separadas permitem recursos funcionais, análises,
          presença anônima em tempo real e publicidade aprovada (incluindo Google AdSense);
          você pode escolher as categorias e mudar de preferência a qualquer momento.{" "}
          <Link to="/cookies" className="text-primary underline">Política de cookies</Link>
          {" · "}
          <Link to="/privacidade" className="text-primary underline">Privacidade</Link>
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
            <label className="flex items-start gap-2 text-foreground">
              <input type="checkbox" checked={presence} onChange={(e) => setPresence(e.target.checked)} />
              <span>Presença online: contar esta aba enquanto estiver visível, sem nome, IP, localização ou histórico. Desative aqui a qualquer momento.</span>
            </label>
            <label className="flex items-center gap-2 text-foreground">
              <input type="checkbox" checked={advertising} onChange={(e) => setAdvertising(e.target.checked)} /> Publicidade (AdSense e campanhas aprovadas)
            </label>
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          {custom ? (
            <button type="button" onClick={() => save({ necessary: true, functional, analytics, advertising, presence })}
              className="h-9 rounded-md border border-primary px-4 text-sm font-medium text-primary">
              Salvar minhas preferências
            </button>
          ) : (
            <button type="button" onClick={() => setCustom(true)}
              className="h-9 rounded-md border border-primary px-4 text-sm font-medium text-primary">
              Personalizar
            </button>
          )}
          <button type="button" onClick={() => save({ necessary: true, functional: false, analytics: false, advertising: false, presence: false })}
            className="h-9 rounded-md border border-primary px-4 text-sm font-medium text-primary">
            Rejeitar
          </button>
          <button type="button" onClick={() => save({ necessary: true, functional: true, analytics: true, advertising: true, presence: true })}
            className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">
            Aceitar todos
          </button>
        </div>
      </div>
    </div>
  );
}
