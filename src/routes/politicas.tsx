import { createFileRoute } from "@tanstack/react-router";
import { TextPage, pageHead } from "@/components/text-page";
import { LEGAL_UPDATED_AT } from "@/lib/legal-documents";

const policies = [
  { href: "/termos", title: "Termos e condições", description: "Cadastro, contratação direta, segurança e deveres dos usuários." },
  { href: "/privacidade", title: "Política de privacidade", description: "Coleta, uso, compartilhamento e proteção dos dados pessoais." },
  { href: "/cookies", title: "Política de cookies", description: "Cookies necessários, opcionais e suas preferências." },
  { href: "/pagamentos-e-reembolsos", title: "Pagamentos e reembolsos", description: "Valores, limite de contatos, atendimento e direitos do consumidor." },
  { href: "/condicoes-do-prestador", title: "Condições para prestadores", description: "Cadastro gratuito, regras de perfil e participação no ecossistema." },
  { href: "/responsabilidades", title: "Responsabilidades", description: "Papéis da plataforma, do cliente e do prestador independente." },
  { href: "/seguranca", title: "Segurança e uso responsável", description: "Medidas contra fraudes, spam e extração de contatos." },
  { href: "/direitos-dos-titulares", title: "Direitos de dados", description: "Solicite acesso, correção, ocultação ou outras providências sobre seus dados." },
] as const;

export const Route = createFileRoute("/politicas")({
  head: () => pageHead("Central de políticas e transparência", "Políticas, termos, pagamentos, privacidade e responsabilidade do Encontre um Técnico.", "/politicas"),
  component: LegalCenter,
});

function LegalCenter() {
  return (
    <TextPage title="Políticas e transparência" intro="Regras claras para quem procura um prestador e para quem oferece seus serviços.">
      <p className="text-xs text-muted-foreground">Documentos atualizados em {LEGAL_UPDATED_AT}.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {policies.map((entry) => (
          <a href={entry.href} key={entry.href} className="block rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary">
            <h2 className="text-base font-semibold text-card-foreground">{entry.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{entry.description}</p>
          </a>
        ))}
      </div>
      <section className="rounded-lg border border-border bg-muted/40 p-5">
        <h2 className="text-base font-semibold text-foreground">Informações comerciais essenciais</h2>
        <p className="mt-2">Cadastro gratuito para prestadores. A contratação do serviço é negociada diretamente entre as partes; o acesso ao contato poderá ter preço de conveniência conforme o horário e a oferta apresentados antes do pagamento.</p>
        <p className="mt-2">Nenhum cadastro significa certificação ou avaliação técnica pela plataforma. Os textos preservam os direitos assegurados pela legislação brasileira.</p>
        <p className="mt-2">Dúvidas, pedidos de privacidade ou reclamações sobre o serviço digital podem ser enviados pela <a href="/contato" className="text-primary underline">página Contato</a>, sem compra prévia.</p>
      </section>
    </TextPage>
  );
}
