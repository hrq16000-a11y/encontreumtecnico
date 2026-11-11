# Micro-rodada 1/5 — convite administrativo pelo proprietário

**Status: preparação em PR isolada.** Não foi implantado no Supabase Auth ou no painel público.

O Supabase EUT (`pqtzhctvjbfcunmrvxne`) tem uma conta com papel de admin e sete contas com papel de técnico na data da leitura. O registro `eut_migration.project_owner_bootstrap` ainda não tem `claimed_user_id`, mas há exatamente uma identidade Google verificada que coincide com o e-mail do proprietário nesse registro e possui papel admin. A função só permite que essa identidade crie ou revogue convites.

## Funcionamento quando homologado
- Proprietário abre `/admin/contas`, informa e-mail e justificativa. O servidor registra convite de 48 horas e auditoria; nenhuma conta ou permissão é criada nesta etapa.
- O proprietário envia **manualmente** o link genérico `/convite-administrativo`. O sistema não envia e-mail nem credenciais por conta própria.
- O destinatário entra com exatamente o mesmo e-mail verificado (Google ou método de Auth suportado), acessa o link e aceita explicitamente.
- A função no servidor confere usuário real do Supabase Auth, e-mail confirmado, expiração, identidade não banida e estado pendente sob `FOR UPDATE`; somente então adiciona papel `admin` no banco e audita.
- Proprietário pode revogar convites pendentes com motivo registrado. Convite aceito **não** pode ser revogado como convite: remoção segura de permissão é uma operação diferente, ainda não implementada.

## Escopo de homologação
1. CI: Vitest (contratos), build TanStack com geração de rotas e TypeScript.
2. SQL: transação com `ROLLBACK` e confirmação de zero objetos persistidos.
3. E2E com contas de teste, em ambiente isolado: proprietário Google, admin secundário, técnico/cliente, usuário sem e-mail verificado, e-mail não convidado, bloqueado, aceite repetido/expirado e revogação concorrente.
4. Verificar que a propriedade da conta permanece exclusiva do proprietário original e que o cliente/visitante não consegue ler o diretório de convites.
5. Antes de habilitar em produção, exigir aprovação específica, plano de rollback e teste de fluxo real.

## Limites
- Nenhuma operação no código desta rodada envia convite por e-mail ou cria conta por API administrativa. O usuário deve cadastrar-se normalmente, com o e-mail convidado.
- O mecanismo de convite não substitui a proteção de sessões existentes nem o Auth Hook de recadastro da PR #139.
- Recusa de conta banida depende de identificadores conhecidos; outra identidade sem evidência compartilhada ainda não é identificável.
- Não modificar `supabase/migrations/` gerenciado pelo Lovable, chaves, DNS, arquivos WordPress, demos ou contas reais.
