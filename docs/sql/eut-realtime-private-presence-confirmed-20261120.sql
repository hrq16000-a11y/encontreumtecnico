-- REGISTRO DAS DUAS POLÍTICAS JÁ ENCONTRADAS NO SUPABASE OFICIAL (READ-ONLY).
-- Os CREATE abaixo são somente para um banco NOVO e ISOLADO de homologação.
-- NÃO EXECUTAR na produção: as duas políticas já existem, duplicaria o DDL.
-- O ambiente deve estar com "Allow public access" do Realtime desativado;
-- conferir antes, pois essa configuração é global ao projeto Supabase.
-- Pré-condições: realtime.messages já tem RLS ativa; public.has_role(uuid, app_role)
-- mantém o contrato administrativo existente. Não habilitar RLS de novo.
-- Canal novo v2: o canal público v1 não pode receber dados novos.

BEGIN;

CREATE POLICY "eut_private_presence_publish_v2"
ON realtime.messages
FOR INSERT TO anon, authenticated
WITH CHECK (
  (SELECT realtime.topic()) = 'eut-consented-visitor-tabs-v2-private'
  AND extension = 'presence'
);

CREATE POLICY "eut_private_presence_admin_read_v2"
ON realtime.messages
FOR SELECT TO authenticated
USING (
  (SELECT realtime.topic()) = 'eut-consented-visitor-tabs-v2-private'
  AND extension = 'presence'
  AND (SELECT public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
);

COMMIT;

-- Em homologação, verificar: visitante anon pode TRACK no canal private:true,
-- mas não recebe presence sync/state; admin autenticado lê a contagem; técnico
-- autenticado não lê; sem consentimento não há TRACK; revogação faz UNTRACK.
-- Se o Realtime impedir TRACK de quem não pode ler, NÃO amplie SELECT para anon:
-- mantenha a métrica suspensa e redesenhe a ingestão pelo servidor.

-- Rollback exclusivo destas políticas (executar somente se necessário):
-- BEGIN;
-- DROP POLICY IF EXISTS "eut_private_presence_admin_read_v2" ON realtime.messages;
-- DROP POLICY IF EXISTS "eut_private_presence_publish_v2" ON realtime.messages;
-- COMMIT;
