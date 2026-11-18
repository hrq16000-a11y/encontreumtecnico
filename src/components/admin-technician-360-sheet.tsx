import type { ReactNode } from "react";
import type { AdminTechnicianRegistryRecord } from "@/components/admin-technician-record-editor";
import { AdminTechnicianContactAccess } from "@/components/admin-technician-contact-access";
import { AdminTechnicianIdentityEditor } from "@/components/admin-technician-identity-editor";
import {
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarDays, MapPin, Pencil } from "lucide-react";

type Technician360Snapshot = {
  key: string;
  name: string;
  location: string;
  specialty: string | null;
  createdAt?: string;
  importedAt?: string;
  updatedAt?: string;
  portalId?: string;
  wpPostId?: number;
  cityIbgeId?: number;
  registry?: AdminTechnicianRegistryRecord;
  demo?: boolean;
};

type TechnicianState = "active" | "inactive" | "review";

function formatDate(value?: string) {
  if (!value || !Number.isFinite(Date.parse(value))) return "Não informado";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(value));
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 rounded-lg border border-border bg-background/80 p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words text-sm font-medium text-foreground">{children}</dd>
    </div>
  );
}

export function AdminTechnician360SheetContent({
  record,
  state,
  onEdit,
}: {
  record: Technician360Snapshot;
  state: TechnicianState;
  onEdit: () => void;
}) {
  const status =
    state === "active"
      ? "Ativo"
      : state === "inactive"
        ? "Suspenso / arquivado"
        : "Situação não confirmada";
  const registry = record.registry;
  const reference =
    registry?.technician_id ??
    record.portalId ??
    (record.wpPostId !== undefined ? `WP ${record.wpPostId}` : null);

  return (
    <SheetContent
      side="right"
      className="flex h-dvh w-full max-w-full flex-col gap-0 overflow-hidden p-0 sm:w-[min(92vw,42rem)] sm:max-w-[42rem] motion-reduce:transition-none"
    >
      <div className="shrink-0 border-b border-border px-4 pb-4 pt-6 pr-12 sm:px-6 sm:pr-12">
        <SheetHeader className="text-left">
          <SheetTitle className="break-words text-xl">Ficha 360° · {record.name}</SheetTitle>
          <SheetDescription>
            Visão administrativa consolidada dos dados já disponíveis.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span
            className={
              "rounded-full px-2.5 py-1 font-semibold " +
              (state === "active"
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                : state === "inactive"
                  ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                  : "bg-muted text-muted-foreground")
            }
          >
            {status}
          </span>
          {record.demo && (
            <span className="rounded-full bg-amber-500/10 px-2.5 py-1 font-semibold text-amber-700 dark:text-amber-300">
              Demonstração protegida
            </span>
          )}
          <span className="inline-flex min-w-0 items-center gap-1 break-words text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {record.location}
          </span>
        </div>
      </div>

      <Tabs defaultValue="cadastro" className="flex min-h-0 flex-1 flex-col px-4 pt-3 sm:px-6">
        <TabsList
          aria-label="Seções da ficha administrativa"
          className="grid h-auto shrink-0 grid-cols-2 gap-1 sm:grid-cols-4"
        >
          <TabsTrigger className="min-h-10 min-w-0 px-2 text-xs" value="cadastro">
            Cadastro
          </TabsTrigger>
          <TabsTrigger className="min-h-10 min-w-0 px-2 text-xs" value="atuacao">
            Atuação
          </TabsTrigger>
          <TabsTrigger className="min-h-10 min-w-0 px-2 text-xs" value="contato">
            Contato
          </TabsTrigger>
          <TabsTrigger className="min-h-10 min-w-0 px-2 text-xs" value="historico">
            Histórico
          </TabsTrigger>
        </TabsList>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-5 pt-2">
          <TabsContent value="cadastro" className="mt-0 space-y-3">
            <dl className="grid min-w-0 gap-3 sm:grid-cols-2">
              <Detail label="Nome profissional">{record.name}</Detail>
              <Detail label="Situação operacional">{status}</Detail>
              <Detail label="Localidade informada">{record.location}</Detail>
              <Detail label="Município IBGE">
                {registry?.city_ibge_id ?? record.cityIbgeId ?? "Não informado"}
              </Detail>
              <Detail label="Cadastro">{formatDate(record.createdAt)}</Detail>
              <Detail label="Última atualização">
                {formatDate(record.updatedAt ?? registry?.updated_at)}
              </Detail>
            </dl>
            {registry?.archived && (
              <p
                role="status"
                className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-foreground"
              >
                Registro arquivado. Esta ficha não altera suspensões nem restaura contatos.
              </p>
            )}
          </TabsContent>
          <TabsContent value="atuacao" className="mt-0 space-y-3">
            <dl className="grid min-w-0 gap-3 sm:grid-cols-2">
              <Detail label="Categoria / especialidade">
                {record.specialty || "Não informada"}
              </Detail>
              <Detail label="Cobertura declarada">
                {registry?.region_approx || record.location}
              </Detail>
              <Detail label="DDD de referência">
                {registry?.ddd ? `${registry.ddd} · região aproximada` : "Não informado"}
              </Detail>
              <Detail label="Serviços cadastrados">
                {registry?.service_slugs?.length
                  ? registry.service_slugs.join(" · ")
                  : "Não informados"}
              </Detail>
            </dl>
            <p className="text-xs text-muted-foreground">
              DDD indica uma área aproximada; não comprova município nem cobertura exata.
            </p>
          </TabsContent>
          <TabsContent value="contato" className="mt-0 space-y-3">
            <div className="rounded-lg border border-border bg-background/80 p-3 text-sm">
              <h3 className="font-semibold">Telefone do cadastro</h3>
              {!record.demo
                ? <AdminTechnicianContactAccess recordKey={record.key} />
                : <p className="text-muted-foreground">Registro de demonstração.</p>}
            </div>
            {!record.demo && <AdminTechnicianIdentityEditor recordKey={record.key} />}
            <p className="text-xs text-muted-foreground">
              Telefone, e-mail e endereço são dados administrativos completos. A suspensão
              do contato com clientes não altera sua visualização na gestão.
            </p>
          </TabsContent>
          <TabsContent value="historico" className="mt-0 space-y-3">
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
              <h3 className="flex items-center gap-2 font-semibold">
                <CalendarDays className="h-4 w-4" aria-hidden="true" />
                Marcos conhecidos
              </h3>
              <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                <Detail label="Data de cadastro">{formatDate(record.createdAt)}</Detail>
                <Detail label="Entrada no sistema">{formatDate(record.importedAt)}</Detail>
                <Detail label="Última alteração registrada">
                  {formatDate(record.updatedAt ?? registry?.updated_at)}
                </Detail>
                <Detail label="Identificador da ficha">{reference ?? "Não disponível"}</Detail>
              </dl>
            </div>
            <p className="text-xs text-muted-foreground">
              Solicitações, interações e eventos de auditoria detalhados ainda não estão conectados
              a esta visão. Ausência de dados aqui não significa ausência de histórico.
            </p>
          </TabsContent>
        </div>
      </Tabs>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-border bg-background px-4 py-3 sm:px-6">
        <SheetClose className="min-h-10 rounded-lg border border-input px-4 text-sm font-semibold hover:bg-muted">
          Fechar ficha
        </SheetClose>
        {!record.demo && !registry?.archived && (
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
            Editar cadastro
          </button>
        )}
      </div>
    </SheetContent>
  );
}
