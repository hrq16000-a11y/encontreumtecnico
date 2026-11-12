# Encontre um Técnico — Rodada 2/5: operações e sessões revogadas

**Estado:** SQL preparado em branch/PR isolada e testado com ROLLBACK. Não equivale a proteção ativada.

## Diagnóstico da main (11/11/2026)
- A PR #138 já impede novos pedidos e novos perfis de contas banidas, e protege atribuições de papel e compartilhamentos existentes.
- Há 14 registros de sessões Supabase no momento da consulta; o número não demonstra quantas são válidas no dispositivo.
- Identificamos outras operações via RPC `SECURITY DEFINER` em `eut_set_my_presence`, `eut_respond_to_direct_request`, `eut_set_my_technician_avatar`, `eut_accept_technician_invite` e `eut_share_direct_request`. A RLS sozinha não protege os INSERT/UPDATE dessas funções.
- Não existem contas bloqueadas por ID no snapshot consultado; há 1 telefone restrito. Testes de banimento real precisam de identidade **de teste**, não de contas reais.

## O que muda quando aplicado
`eut_sensitive_session_active()` verifica para o próprio `auth.uid()`:
1. Conta não banida por UUID e sem telefone cadastrado em lista restrita.
2. JWT contém `session_id` associado ao mesmo usuário em `auth.sessions`. Se a sessão do provedor já tiver sido revogada e removida, uma JWT ainda dentro do prazo deixa de autorizar as operações protegidas.
3. A função privada de checagem de terceiros **não** é executável diretamente por `anon` ou `authenticated`.

Cinco políticas `AS RESTRICTIVE` exigem sessão operacional para leitura de pedidos/compartilhamentos/claims, criação de claims e edição autenticada de técnicos. As permissões existentes continuam limitando a titularidade, incluindo a moderação pelo administrador.

Cinco gatilhos são a segunda barreira para alterações oriundas de RPCs privilegiadas: perfil, presença, respostas diretas, compartilhamento e indicações. Validam o ator e, nos fluxos de interação, os participantes. O administrador com sessão válida continua podendo **suspender ou revisar** o perfil de uma conta banida. A operação de colocar presença offline continua permitida como medida de segurança.

## Homologação / rollback
1. Preservar a PR #133 (popup Google), a PR #139 (Auth Hook) e a PR #142 (convites), todas sem fusão nesta rodada.
2. Rodar Vitest, build TanStack e TypeScript no GitHub; validar o SQL em transação e confirmar rollback (sem política/gatilho persistido).
3. **Ambiente isolado**: entrar com contas legítimas técnico, cliente e admin; confirmar pedidos, painel, geolocalização, galeria, upload, mensagens e cadastro WordPress. Simular banimento de **conta de teste** em sessão aberta; conferir falha no banco para perfis, presença, respostas, claims, indicações e compartilhamento, mantendo suporte acessível.
4. Simular revogação da sessão de teste pela API autorizada; validar que JWT existente não passa pelas RPCs/RLS protegidas. Testar restabelecimento e desbanimento.
5. Somente após aprovação e compatibilidade, considerar a aplicação em produção e monitorar erros. O rollback **não se limita às 5 políticas e 5 gatilhos**: este SQL também cria ou substitui **3 funções** (`eut_moderation.subject_operational(uuid)`, `public.eut_sensitive_session_active()` e `eut_moderation.guard_sensitive_write()`). O plano precisa ser ensaiado em staging com os objetos e permissões anteriores inventariados, antes de qualquer instalação real.

### Rollback completo — obrigatório antes de ativar

- **Pré-instalação:** capturar de forma auditável as definições, owners, grants/revokes, dependências e existência anterior das 3 funções, 5 políticas e 5 gatilhos. Em especial, `eut_moderation.subject_operational(uuid)` usa `CREATE OR REPLACE`: **restaurar sua versão original, caso preexistente**, em vez de simplesmente removê-la. Confirmar estado real do banco, não deduzir pela branch.
- **Reversão ensaiada:** em transação e ordem compatível com dependências, desfazer apenas as 5 políticas `eut_session_*` e 5 gatilhos `eut_active_session_*` introduzidos pela rodada; restaurar ou remover, conforme inventário anterior, as 3 funções e seus privilégios/proprietários. Não empregar `DROP ... CASCADE` nem modificar proteção anterior da PR #138. Revalidar integridade de RLS, RPCs, auditoria, operações reais e ausência de objetos residuais.
- **Gate operacional:** demonstrar com E2E isolado o resultado para sessão normal, revogada, banida, admin e manutenção interna sem JWT. Bloqueios intencionais a sessões inválidas não justificam introduzir bypass genérico para `service_role`, `auth.uid() IS NULL` ou rotinas privilegiadas. Qualquer caminho interno necessário exige design e autorização separados.

Não existe autorização para executar este rollback ou aplicar o SQL nesta revisão documental.

**Limites importantes:** esta rodada não revoga refresh tokens do Auth, não faz logout Google, não altera `auth.sessions`, não desativa automaticamente todas as interfaces ou endpoints não mapeados e não identifica alguém com e-mail/telefone inteiramente diferentes. Para revogação integral e imediata, o backend precisará de rotina privilegiada, auditada, com API do provedor e validação de autorizações. Até lá o bloqueio é das operações explicitamente cobertas por estas políticas/triggers.

Não usar segredos no navegador; sem alterações em `supabase/migrations/`, Lovable, WordPress, 20 demos, DNS ou Vercel.

## Revisão do rascunho após reconciliação com a main (12/11/2026)

- **Ainda não aplicado**: a consulta anterior confirmou que a função `eut_sensitive_session_active`, as cinco políticas `eut_session_%` e os cinco triggers `eut_active_session_%` não constavam do banco dedicado.
- A função de elegibilidade de outra identidade agora exige a existência real do UUID em `auth.users`, correção identificada na PR #153. Não se basear apenas na ausência do UUID nas listas de banimentos.
- O gatilho agora rejeita explicitamente `auth.uid() IS NULL`. Não usar `SECURITY DEFINER` para inferir que o chamador é serviço confiável. **Risco operacional**: rotinas agendadas/administrativas que escrevem sem JWT podem ser afetadas; mapear uma a uma em staging e criar mecanismo de manutenção explícito, autenticado, minimamente privilegiado e auditado antes de qualquer instalação.
- A exceção para colocar o técnico offline exige `UPDATE` com `OLD.user_id = NEW.user_id = auth.uid()`. Nenhum outro perfil pode ser alterado pela exceção. Confirmar com RLS/RPC real; testes do contrato em código não comprovam segurança do banco.
- Revisar titularidade e `search_path` de funções, acesso por `anon` e `authenticated`, cancelamento de sessão em `auth.sessions`, clientes OAuth móveis/desktop, permissões de Storage e operações de serviço.
- **NÃO executar nem fazer merge/publicação** deste SQL sem plano de staging, transação ensaiada, testes com identidades sintéticas, validação de rotinas internas e autorização própria. O commit desta revisão muda somente arquivos desta branch Draft, sem tocar no Supabase ou em migrations de produção.
