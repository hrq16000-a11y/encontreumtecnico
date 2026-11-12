# EUT — Portabilidade seletiva dos cenários sintéticos da PR #153 (12/11/2026)

## Escopo

Base exata: `main` `856a3fbd8f09d6bcb98f827c7eb52bade52b63c5`. A PR #153 fechada foi uma homologação de **componentes experimentais não integrados** (`AuthDialogProvider`, `AdminInvitesManager` e `AdminInvitationPage`). Copiar aqueles testes diretamente quebraria CI por imports inexistentes e não testaria o produto publicado.

A micro-rodada reescreve apenas os **cenários aplicáveis às funções já existentes**, com Supabase inteiramente simulado: aceite de termos, convite de técnico/cliente, ausência de convite, recusa de usuário, resposta de servidor com papel indevido, erro privado não exibido, confirmação administrativa, normalização de e-mail, intenção de cadastro sem privilégios e destino OAuth seguro.

Arquivos: `src/components/eut-auth-main-functional.test.tsx`, `src/lib/eut-signup-intent-functional.test.ts`, workflow de Vitest/build/TypeScript. **Nenhum SQL de instalação ou smoke, migração, usuário real, senha, token ou sessão**; nenhuma chamada externa e nenhum serviço de e-mail é invocado. Não se cria componente novo nem se alteram rotas em produção.

## Fronteira de segurança

- Os testes validam a lógica de interface com retornos controlados de RPC, **não** os papéis nem RLS do banco.
- Convite para técnico/cliente (`eut_admin_member_invite_action`, existente na main) é diferente do convite de **administrador proprietário** da PR #142. Não confundir os fluxos, e não copiar testes de administração para a interface pública.
- O modal OAuth da #133 e o Auth Hook da #139 não existem na main; exigem homologação separada.
- A proteção de sessão da #145 permanece proposta Draft, sem SQL executado; E2E com sessão revogada continua pendente.
- Os testes históricos não transferidos continuam preservados nos HEADs das PRs #147/#153 e na Issue #223.
- Não ativar hook, SQL, papéis, dados, importações, DNS, WordPress, Lovable ou outro projeto.

## Aceite

Executar GitHub Actions reais no HEAD desta branch: Vitest, build TanStack, TypeScript, revisão de privacidade. Merge de **testes e documentação apenas**, sem criar publicação no Vercel (não usar `release:` para commits exclusivos de QA).
