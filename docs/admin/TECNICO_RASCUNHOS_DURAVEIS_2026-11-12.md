# P0 — Rascunhos duráveis de cadastro técnico (proposta isolada)

Data da verificação: **12/11/2026** · Issue **#89** · Backend oficial: **Supabase dedicado** · Código: GitHub/Vercel. Lovable **não** é fonte de migrações.

## Evidência agregada, sem dados pessoais

Consultas somente leitura no banco dedicado, sem abrir nomes, e-mails, telefones ou IDs:

- Oito contas com papel de técnico.
- Cinco técnicos com perfil; três contas técnicas confirmadas sem perfil, criadas entre dois e sete dias atrás.
- Nenhuma tabela/RPC própria para rascunhos de técnicos no Supabase dedicado.
- No recorte de logs de 24h, uma ocorrência `P0001` associada à RPC de publicação; **não é prova da causa das três contas sem perfil**.
- A publicação real `eut_publish_my_technician` exige papel técnico, confirmação de e-mail, município IBGE válido, serviços ativos e bloqueia contas/números restritos.
- A interface atual usa `sessionStorage` por conta e por aba, com TTL de **45 minutos**. Não pode ser chamada de recuperação durável.

## Proposta — SEM implantação em Supabase

`docs/sql/eut-technician-drafts-rls-staging-proposal-20261112.sql`:

- Tabela `public.eut_technician_drafts`, **uma linha por `auth.users.id`**, sem contaminar `technicians` nem perfis públicos.
- RLS obrigatória com `auth.uid() = owner_id` **e papel `tecnico`**. Papéis `cliente`, `anon` e outros técnicos não leem, gravam ou removem rascunhos.
- Payload JSON com **lista fechada de campos** (nome de exibição, UF, município, bairro, região, bio, categorias, serviços e ID IBGE), limite de **7.500 bytes**, etapas 1–3. **Proibidos** número de telefone, contato pago, e-mail, tokens OAuth, pagamentos, localização GPS e campos desconhecidos.
- Versão monotônica para proteger concorrência entre abas: tentativa de sobrescrever uma revisão ultrapassada gera erro, não apaga a versão mais recente.
- Validade renovada **pelo relógio do servidor**: 30 dias a partir do último salvamento. O usuário não pode falsificar `expires_at`; a leitura de rascunhos vencidos é impedida por RLS. **Ainda é necessário homologar limpeza física periódica dos expirados** antes de produção.
- Nenhuma alteração na RPC de publicação; o rascunho **não ativa nem aprova** o perfil.
- SQL arquivado **somente em `docs/sql/`**, não em `supabase/migrations/`, e jamais executado contra produção nesta rodada.

## Fixtures em PostgreSQL isolado (sem acesso ao Supabase real)

- `docs/sql/tests/eut-technician-draft-ephemeral-schema-20261112.sql`
- `docs/sql/tests/eut-technician-draft-ephemeral-assertions-20261112.sql`
- `.github/workflows/eut-technician-draft-rls-staging.yml`

Cobrem: salvamento privado, recuperação pela mesma conta após reiniciar sessão, outro técnico sem acesso, cliente não autorizado, visitante anônimo, revisão obsoleta, campos proibidos, TTL de 30 dias, expiração e exclusão apenas do próprio rascunho. Banco fictício PostgreSQL 16 no GitHub Actions, sem API key ou credenciais do Supabase.

## Próxima micro-rodada exigida ANTES da integração no frontend

1. Checar permissões de schemas, gatilhos, reservas de nomes e papel técnico contra **staging que espelhe o banco oficial**, sem criar novo backend permanente.
2. Definir limpeza física auditável dos expirados e contrato de retenção/privacidade. Nenhuma limpeza real foi realizada.
3. Aplicar a migração pelo fluxo versionado e autorizado **somente após staging**, com reversão documentada; verificar grants da Data API e RLS em sessão autenticada e no papel anônimo.
4. Conectar o formulário ao armazenamento no Supabase somente **quando a tabela existir**. Enquanto isso, manter rascunho atual de 45 min como fallback; salvar automaticamente com debounce/na troca de etapa e validar a resposta do servidor. Nunca usar `service_role` no browser ou `localStorage` persistente para dados não enviados.
5. Carregar rascunho apenas da identidade confirmada, evitar respostas assíncronas de contas anteriores e tratar conflito de versão; limpar apenas após a RPC de publicação confirmar `state='publicado'`.
6. Testar conta de QA com autorização: digitar no celular, mudar de dispositivo/aba, recuperar cidade IBGE e `Jardim Itália`, perder rede, trocar de conta, publicar, encontrar perfil na galeria e confirmar que telefone privado não aparece em SSR/HTML/JSON-LD.
7. **Conta QA autenticada não foi disponibilizada nesta rodada**; não registrar sucesso de E2E sem evidência de sessão autorizada.

## Issue #210 — administração

A consulta read-only anterior identificou ausência de `eut_admin_technician_change`, `eut_admin_technician_archive` e tabela de arquivos reversíveis. O SQL da PR #212 está documentado e foi testado em PostgreSQL efêmero, mas **não instalado em produção**. Não conectar botões de edição/arquivamento antes da homologação completa da migração e permissões. O administrador pode usar as funções existentes para moderação e leitura auditada.

## Preservação

Sem SQL de escrita, alteração de perfis, usuários, convites, banimentos, telefone, dados de produção, WordPress, Lovable, DNS ou Vercel; sem consulta à fonte externa de técnicos. `main` e todas as PRs existentes preservadas. **Esta rodada não afirma resolver definitivamente a publicação de técnicos.**
