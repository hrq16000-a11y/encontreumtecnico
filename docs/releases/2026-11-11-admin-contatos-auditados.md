# Release administrativa — 11 de novembro de 2026

## Commit integrado
- Merge de código: `a5139256a15ada437bb82e1f031a040d08464d10` na `main`.
- Pull request de consolidação: #212, contendo mudanças aprovadas nas PRs #209 e #211.
- Gates da versão consolidada: 7/7 **SUCCESS** no HEAD `ab0aaf4a4730251c33aca2c66bd4c2ee3ca1d4ca`.
- Projeto: `hrq16000-a11y/encontreumtecnico`, Vercel `msolus/encontreumtecnico`, Supabase dedicado `pqtzhctvjbfcunmrvxne`.

## O que a release disponibiliza
- Nova área `/admin/contatos` somente para contas administradoras autorizadas.
- Consulta paginada de técnicos por nome, cidade, e-mail e telefone; status e bloqueios.
- Leitura do telefone completo mediante justificativa registrada em auditoria. O número é ocultado ao trocar de aba, navegar ou após 60 segundos; não aparece em páginas públicas.
- Ficha detalhada do técnico (cidade, bairro, cobertura e serviços) em consulta protegida por RLS.
- Operações administrativas já existentes no Supabase para bloqueio de conta e telefone, suspensão, revisão e atualização do estado de mensagens, com confirmação e justificativa.

## O que NÃO é publicado como funcionalidade operacional
- Arquivos `docs/sql/*` são **propostas e testes**; não são migrações executadas.
- A edição transacional de telefone, município IBGE, cobertura e serviços e o arquivamento reversível **ainda dependem da instalação homologada de novas RPCs** no Supabase dedicado.
- Não foram criados técnicos externos, contatos adquiridos ou contas falsas. Os lotes GuiaFix das PRs #200/#207/#208 permanecem não publicados.
- O cadastro P0 da PR #193 permanece separado, por apresentar divergência contra a main; o funil regional #205 segue sem gates reais aprovados.

## Política de release Vercel

O projeto utiliza `Ignored Build Step` que só publica commits cujo título começa com `release:` ou `[publish]`. O merge de código `release(admin):` foi recusado pelo filtro (exit 0); **não foi falha de compilação**. Esta release registra o estado operacional e utiliza o prefixo oficial, sem desativar a proteção.

## Governança
- Sem mudanças de DNS, Supabase real, WordPress, Lovable, arquivos pessoais ou cadastros de produção.
- Não são necessárias múltiplas reconstruções da mesma versão. Confirmar deployment **READY** e commit de release na Vercel, além de acesso público e `noindex` em /admin.
