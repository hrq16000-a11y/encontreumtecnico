type PublicServiceLogisticsProps = {
  categorySlug: string;
  categoryName: string;
};

function hasBatteryContext(slug: string, name: string) {
  return ["computadores", "eletrica"].includes(slug) || /bateri/i.test(slug + " " + name);
}

/**
 * Orientações editoriais para todas as categorias públicas. Não representa
 * disponibilidade, veículo, valor de km ou prazo de um técnico específico.
 */
export function PublicServiceLogistics({ categorySlug, categoryName }: PublicServiceLogisticsProps) {
  const batteryContext = hasBatteryContext(categorySlug, categoryName);

  return (
    <section aria-labelledby="logistica-do-atendimento" className="mt-10 rounded-2xl border border-border bg-card p-5 sm:p-7">
      <p className="text-xs font-bold uppercase tracking-wider text-primary">Antes de solicitar atendimento</p>
      <h2 id="logistica-do-atendimento" className="mt-2 text-xl font-bold text-foreground sm:text-2xl">
        Deslocamento, locomoção e disponibilidade
      </h2>
      <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">
        Para contratar profissionais de {categoryName.toLocaleLowerCase("pt-BR")}, compare o serviço declarado
        e confirme a logística diretamente com cada técnico. Cidade-base e raio aproximado não significam
        deslocamento gratuito ou chegada imediata.
      </p>
      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-border/70 bg-background p-4">
          <h3 className="font-semibold text-foreground">Cobertura e meio de locomoção</h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Pergunte se o atendimento é remoto, presencial ou em oficina; quais municípios atende,
            se dispõe de transporte adequado e se realiza viagens. O meio de locomoção é uma declaração
            opcional, não deve ser presumido pela foto ou pela localização aproximada.
          </p>
        </div>
        <div className="rounded-xl border border-border/70 bg-background p-4">
          <h3 className="font-semibold text-foreground">Taxas de visita e quilometragem</h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Antes de confirmar a visita, pergunte sobre área sem cobrança de deslocamento, franquia em km,
            valores após a franquia, pedágios e eventual taxa de diagnóstico. Solicite as condições
            por escrito; um raio de cobertura não equivale ao percurso rodoviário cobrado.
          </p>
        </div>
        <div className="rounded-xl border border-border/70 bg-background p-4">
          <h3 className="font-semibold text-foreground">Horário, plantão e prazo estimado</h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Confirme atendimento comercial, noturno, de madrugada, aos fins de semana e feriados.
            Diferencie prazo para responder do tempo estimado para chegar ao local. Um atendimento
            às 15h pode ter condições diferentes de um chamado às 3h.
          </p>
        </div>
      </div>
      {batteryContext && (
        <div className="mt-5 rounded-xl border border-primary/20 bg-primary/5 p-4">
          <h3 className="font-semibold text-foreground">Se o atendimento envolver baterias</h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Informe o tipo de equipamento (por exemplo, notebook ou nobreak), marca, modelo e sintoma.
            Pergunte se o profissional realiza diagnóstico, substituição compatível, atendimento no local
            e encaminhamento para descarte adequado. Não presuma que todo eletricista ou técnico de
            computadores trabalhe com qualquer tipo de bateria. Se houver inchaço, vazamento ou
            aquecimento anormal, interrompa o uso e evite manuseio ou reparo improvisado.
          </p>
        </div>
      )}
      <p className="mt-5 text-xs leading-6 text-muted-foreground">
        Estas são perguntas para a contratação, não qualificações comprovadas de quem aparece na lista.
        O portal não acessa GPS preciso, não garante prazos de chegada e não publica documentos ou contatos privados.
      </p>
    </section>
  );
}
