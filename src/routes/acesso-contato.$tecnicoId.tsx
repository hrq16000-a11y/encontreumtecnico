import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { PageShell } from "@/components/page-placeholder";
import { AssistanceFunnel } from "@/components/assistance-funnel";
import { getApprovedTechnician } from "@/lib/technicians.functions";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const Route = createFileRoute("/acesso-contato/$tecnicoId")({
  loader: async ({ params }) => {
    if (!UUID.test(params.tecnicoId)) throw notFound();
    const technician = await getApprovedTechnician({ data: { id: params.tecnicoId } });
    if (!technician) throw notFound();
    return technician;
  },
  head: () => ({ meta: [
    { title: "Solicitar contato pelo atendimento — Encontre um Técnico" },
    { name: "robots", content: "noindex, nofollow" },
    { name: "description", content: "Atendimento guiado para solicitar orientação sobre o contato do técnico, sem pagamento ou liberação automática de números." },
  ] }),
  component: ContactInterestPage,
});

/** Compatibilidade com links históricos: sem checkout, sem consulta de compra
 * e sem revelar número, mantendo o técnico aprovado como referência.
 */
function ContactInterestPage() {
  const technician = Route.useLoaderData();
  const navigate = useNavigate();
  return (
    <PageShell>
      <section className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
        <Link to="/tecnicos/$tecnicoId" params={{ tecnicoId: technician.public_slug }}
          className="text-sm font-semibold text-primary hover:underline">
          ← Voltar ao perfil do técnico
        </Link>
        <div className="mt-5 overflow-hidden rounded-3xl border border-primary/20 bg-card shadow-xl">
          <div className="bg-gradient-to-br from-brand-navy to-primary px-6 py-7 text-white">
            <span className="text-xs font-bold uppercase tracking-widest text-white/80">Atendimento sem cobrança nesta etapa</span>
            <h1 className="mt-2 text-2xl font-extrabold text-white sm:text-3xl">Solicitar contato de {technician.display_name}</h1>
            <p className="mt-2 text-sm leading-6 text-white/85">
              O pagamento e a validação de compras estão pausados. Conte o que precisa
              e registraremos seu interesse no funil. Nenhum telefone é liberado.
            </p>
          </div>
          <AssistanceFunnel
            context={{ mode: "direct", technicianId: technician.id, technicianName: technician.display_name }}
            onClose={() => void navigate({
              to: "/tecnicos/$tecnicoId", params: { tecnicoId: technician.public_slug },
            })}
          />
        </div>
      </section>
    </PageShell>
  );
}
