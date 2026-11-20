# PR #359 — Gate de instalação administrativa Mercado Pago (20/11/2026)

**Estado: NO-GO. Documento de preparação, não autorização de SQL.**

Escopo futuro proposto: `docs/sql/eut-mp-owner-settings-20261120.sql` (contrato administrativo somente). **Não** instalar ainda `eut-mp-quote-snapshot-20261120.sql` nem `eut-mp-quote-prepare-binding-20261120.sql`. Não habilitar checkout, webhook, cobrança, contato privado ou entrega de direitos.

Referência inspecionada: PR #359, HEAD `b2a07359810131b7fee3f84999282fde153801f4`, blob do SQL administrativo `556ecad98ba37e23f5f9f5a3745edb7685b5b877`. Supabase: projeto EUT dedicado, PostgreSQL 17.11. As observações abaixo vieram **somente de SELECT de metadados/booleanos**, sem divulgar identidades, e-mails, telefones, sessões ou linhas de contato.

## Preflight observado (somente leitura)

| Gate | Estado |
| --- | --- |
| `eut_migration`, `project_owner_bootstrap`, `auth.sessions.not_after` | Presentes |
| `public.has_role(uuid,public.app_role)` e `public.eut_account_operational()` | Presentes; `SECURITY DEFINER`, EXEC `authenticated`, sem EXEC `anon` |
| Papel enum `admin` | Presente |
| `mp_owner_settings`, `mp_owner_settings_audit`, guard e RPCs administrativas propostas | **Ausentes** como esperado antes da instalação |
| Bootstrap: singleton único, e-mail configurado, `claimed_at` vazio | Confirmado |
| Bootstrap: `claimed_user_id` presente | **NÃO** |
| Conta única com Google verificado, e-mail confirmado e papel `admin` correspondente ao bootstrap | **SIM**; um único administrador |
| Conta sem bloqueio, sem telefone em lista de bloqueios, sessão não expirada associada | Confirmado em resultados booleanos; **não comprova posse da sessão pelo operador** |
| RLS de bootstrap, intenções, direitos e contatos privados | Ativo nas quatro tabelas |
| DML direto de `anon`/`authenticated` nessas quatro tabelas | Negado |
| Homologação PostgreSQL descartável de owner, preços e cotação/pré-pedido | 8 + 7 + 11 grupos aprovados anteriormente; não substitui E2E autenticado oficial |

**Bloqueio comprovado:** o proprietário já tem `admin`, mas o bootstrap não tem `claimed_user_id`. `eut_bootstrap_project_owner()` recusa quando já existe administrador. Não chamar a RPC para tentar contornar e **não** forjar JWT/sessão. Sem corrigir governança, a nova `mp_is_current_owner()` responderá falso e o painel não salvará.

## Procedimento proposto — duas decisões distintas

### Gate A: reconciliar legitimamente o vínculo existente (NÃO AUTORIZADO)

1. Revalidar imediatamente antes, **sem emitir IDs/e-mails**: uma única identidade Google com e-mail verificado e `admin` correspondente ao `owner_email`; um único papel `admin`; bootstrap singleton, `claimed_user_id IS NULL`, `claimed_at IS NULL`; ausência de bloqueio e prova de sessão proprietária legítima.
2. Submeter para aprovação específica **uma única transação de reconciliação**, com correspondência do proprietário feita no servidor e `WHERE claimed_user_id IS NULL AND claimed_at IS NULL`; exigir exatamente uma linha atualizada, sem criar/admin adicional e sem tocar em outras identidades.
3. Registrar aprovação, razão, SHA/SQL executado, horário e somente resultados booleanos/contagem; preservar histórico. Em falha ou divergência: `ROLLBACK`, **NO-GO**.
4. Reconsultar em leitura: `claimed_user_id` vinculado à única conta Google/admin verificada, `claimed_at` preenchido, nenhuma alteração de papéis e ausência de bloqueios. Testar com sessão real do titular; metadados por si só não autenticam o operador.

**Não executar uma alteração administrativa de bootstrap a partir deste documento.** Gerar/revisar a instrução exata e homologá-la isoladamente antes de uma autorização específica.

### Gate B: instalar contrato administrativo (NÃO AUTORIZADO)

Só após **Gate A** aprovado e comprovado. Revalidar imediatamente os preflights do arquivo SQL, identidade autorizada, objetos ainda ausentes, versão do servidor, RLS e grants. Conferir o hash do blob com a PR antes de executar.

Executar **exclusivamente** `docs/sql/eut-mp-owner-settings-20261120.sql` como a transação única `BEGIN … COMMIT` que já consta no arquivo. Ela propõe somente:

- Tabela privada singleton com `enabled=false`, valores iniciais 999/2999 centavos, faixa 09:00–18:00, limite 2 e versão 1.
- Tabela privada de auditoria com RLS e sem DML direto de clientes.
- Guard do proprietário com papel administrativo, conta operacional, identidade reivindicada, e-mail confirmado e `session_id` ligado a `auth.sessions` válida.
- RPCs públicas **apenas de leitura/edição administrativa**, com `EXECUTE` para `authenticated` e guarda interna; sem acesso `anon`.

Não altera RPCs de cotação/preparação, tabela de pré-pedidos, `eut_contact_entitlements`, técnicos, contatos, moderação, suspensos, Pioneiros, gateways, credenciais ou fluxos públicos.

### Pós-instalação exigida antes de qualquer merge/deploy

1. Reconsultar RLS, revogações de acesso direto, funções `SECURITY DEFINER`, `search_path`, privilégios `anon` e `authenticated`.
2. Confirmar singleton único com `enabled=false`, versão 1 e zero eventos de auditoria.
3. Com sessão real do proprietário (sem forjar JWT), confirmar leitura e edição auditada em ambiente aprovado; negar segundo administrador, cliente e anônimo. Qualquer alteração de teste autorizada deve ser restaurada com registro de auditoria, nunca apagar eventos.
4. Verificar ausência de mudança nas relações protegidas; nenhuma consulta/exposição de telefones privados. Sem checkout, sem chamadas à API Mercado Pago e sem cobranças.
5. Se falhar qualquer gate, manter a funcionalidade indisponível; **não** mesclar, publicar ou ativar.

## Rollback e preservação

- **Antes do COMMIT:** erro de preflight/DDL aborta a transação inteira. Executar `ROLLBACK` se a sessão ficar em estado abortado; confirmar objetos ausentes.
- **Depois do COMMIT:** as configurações nascem desativadas. A recuperação operacional preferida é **manter desativado** e não conectar checkout/cotação, preservando auditoria. Não apagar dados para “voltar ao normal”.
- Eventual remoção dos objetos exige novo SQL destrutivo, revisão de dependências, zero eventos de auditoria e **autorização distinta**. Nunca remover o vínculo legítimo do proprietário automaticamente no rollback do módulo Mercado Pago.
- No plano sem backup físico recuperável, registrar hashes, consultas de estado e testes; uma transação não substitui um backup, nem recupera alterações após COMMIT.

## Decisão necessária

**NO-GO atual por `claimed_user_id IS NULL`.** Pedir primeiro autorização específica para preparar e homologar a *reconciliação do proprietário já verificado*; depois solicitar separadamente autorização para o SQL administrativo. Aprovar essas duas etapas não autoriza cobranças reais, segredos, merge, deploy ou demais scripts da PR #359.
