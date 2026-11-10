import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type DirectRequest = {
  id: string;
  title: string;
  description: string;
  category: string;
  city: string;
  region: string | null;
  created_at: string;
};

export function TechnicianDirectRequests({ userId }: { userId: string }) {
  const [requests, setRequests] = useState<DirectRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const profile = await supabase.from("technicians")
        .select("id,status").eq("user_id", userId).maybeSingle();
      if (profile.error) throw profile.error;
      if (!profile.data || profile.data.status !== "aprovado") {
        setRequests([]);
        return;
      }
      // SELECT is permitted by RLS only when the client has explicitly
      // consented to share this one request with the owner of this profile.
      const result = await supabase.from("service_requests")
        .select("id,title,description,category,city,region,created_at")
        .eq("technician_id", profile.data.id)
        .order("created_at", { ascending: false }).limit(30);
      if (result.error) throw result.error;
      setRequests(result.data ?? []);
    } catch {
      setError(true);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { void refresh(); }, [refresh]);

  return (
    <section className="mt-8 rounded-lg border border-border p-5" aria-labelledby="direct-requests-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="direct-requests-title" className="text-lg font-semibold text-foreground">
          Pedidos enviados diretamente a você
        </h2>
        <button type="button" onClick={() => void refresh()} disabled={loading}
          className="min-h-10 rounded-md border border-input px-3 py-2 text-sm text-foreground disabled:opacity-60">
          Atualizar pedidos
        </button>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Apenas solicitações compartilhadas voluntariamente pelo cliente para este perfil.
        Não há distribuição automática, contratação, reserva ou liberação de contatos.
      </p>
      {loading ? <p role="status" className="mt-4 text-sm text-muted-foreground">Carregando pedidos…</p>
        : error ? <p role="alert" className="mt-4 text-sm text-destructive">Não foi possível consultar os pedidos. Tente atualizar.</p>
        : requests.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">Nenhum pedido enviado diretamente a você.</p>
        : (
          <ul className="mt-4 grid gap-3">
            {requests.map((request) => (
              <li key={request.id} className="rounded-lg border border-border bg-card p-4">
                <h3 className="font-semibold text-card-foreground">{request.title}</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {request.category} · {request.city}{request.region ? ` · ${request.region}` : ""}
                  {" · "}{new Date(request.created_at).toLocaleDateString("pt-BR")}
                </p>
                <p className="mt-3 whitespace-pre-line break-words text-sm text-foreground">{request.description}</p>
                <p className="mt-3 text-xs text-muted-foreground">
                  O contato privado do cliente não está disponível nesta mensagem.
                  Não compartilhe dados pessoais de terceiros.
                </p>
              </li>
            ))}
          </ul>
        )}
    </section>
  );
}
