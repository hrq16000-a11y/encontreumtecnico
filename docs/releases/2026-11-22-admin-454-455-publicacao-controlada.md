# EUT — publicação controlada das correções administrativas #454 e #455

Data local de preparação: 22/11/2026. Este registro complementa `docs/releases/2026-11-22-pacote-funcional.md`, sem substituir seu histórico.

## Itens incluídos

- PR #454 — isolamento do telefone privado ao alternar fichas A→B→A e estado de cópia. HEAD `ee35c57407b9c81f47857c1b093a05927411b206`; squash merge `ddc3211c4760f89684241cf97a6c5d900accc9c4`.
- PR #455 — recuperação da última página válida em solicitações após atualização. HEAD `c38ec8d1896112c395f977cec0d2059dab375332`; squash merge `607e0395ddd6f22b1e787b3190f6a8b4e39397a6`.
- Escopo de runtime: `src/components/admin-technician-contact-access.tsx` e `src/components/admin-request-queue.tsx`. Os dois arquivos de regressão `*.test.tsx` correspondentes também integram esta árvore.

## Fonte, proteção e limites

- Construído a partir do READY de produção `40d9f0050921f7b5f06d7215f819f6eaf1075ce3`, deployment `dpl_BiQvi9YmKewsTaZtfoCNbLqpsYXX`, e não de toda a `main` divergente.
- Antes de aplicar as correções, os blobs dos dois componentes na árvore do READY eram idênticos aos blobs da base das respectivas PRs. Nenhuma outra alteração de runtime foi incluída.
- Foram reutilizados `ci` e `process` aprovados. **QA visual autenticada 390/1440 não executada**: exceção de risco residual assumida pelo proprietário. Não afirmar aprovação visual, segurança de backend adicional ou paridade integral.
- Nenhum SQL, RLS, alteração de dados, contatos privados reais, regras de negócio, importações ou infraestrutura foi modificado.
- PR #451 permanece fechada e não integrada; #458 fechada e não integrada; #439 Draft. Não fazem parte desta release.
- Reversão prevista: retornar ao deployment READY anterior `dpl_BiQvi9YmKewsTaZtfoCNbLqpsYXX`, após verificação de titularidade e aliases. Não reverter dados.

## Vercel e rastreabilidade

- Projeto: `msolus/encontreumtecnico` (`prj_VaqJJAu3HfqcsRtUqZmeD8LCOaIy`); domínio oficial: `www.encontreumtecnico.com.br`.
- A configuração de Ignored Build Step exige título de commit iniciado por `release:` ou `[publish]`. A tentativa anterior `470fe0872650b5a755546d850f74f478780d40b7` foi `CANCELED` em `dpl_8EkbQQYYyPXjfJ4iC7JaTM6srAiw` por usar `release(admin):`; não alteramos a configuração.
- Este commit usa prefixo `release:` para respeitar o gate existente. O SHA e ID definitivos do deployment deverão ser registrados em comentário na PR #454 e na PR #455 **somente depois** de confirmação Vercel `READY` e do alias oficial. O presente documento não comprova sozinho a publicação.
