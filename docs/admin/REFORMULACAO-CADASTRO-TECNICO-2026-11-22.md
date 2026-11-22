# Cadastro manual de técnicos — correção da experiência administrativa (22/11/2026)

## Origem e evidência

Relato do proprietário com seis capturas da produção em `/admin/tecnicos`: formulário de inclusão inserido no fluxo da lista, ocupando muito espaço e duplicando a navegação; campos técnicos como DDD, região aproximada e IBGE expostos sem contexto; exigência repetitiva de "Justificativa de auditoria" e confirmação manual; botão com erro "Informe um nome profissional válido, sem contatos." após inserir nome sintético com data `20261122`. A página com a falha **não salva** aquele nome porque a validação do frontend barra oito dígitos em qualquer nome, antes da RPC. Não há prova de que a RPC estivesse indisponível.

O registro de backend anteriormente homologado em transação com `ROLLBACK` mostrou criação/releitura/arquivamento por RPC, mas **não** comprova ponta a ponta HTTP, nem valida este frontend publicado.

## Contrato de interface desta micro-PR

1. O botão **+ Adicionar técnico** abre um diálogo próprio, com fundo modal e foco gerenciado pelo Radix já instalado; a listagem fica atrás, sem duplicar o formulário no fluxo da página. Fechamento por Cancelar, X e Escape.
2. A primeira tela de cadastro pede **Nome** (único campo obrigatório), **Telefone** (privado, opcional, com DDD no próprio número) e **Cidade** (opcional; selecionar uma sugestão do catálogo, sem expor código IBGE). A busca de cidade aceita digitar, mas exige seleção da sugestão quando o campo está preenchido.
3. **Categorias e serviços** e **Informações adicionais** ficam em seções recolhidas, sem perder dados existentes na edição. Campos desconhecidos permanecem vazios; não derivar município exato do DDD.
4. Não solicitar justificativa/termo de consentimento do administrador a cada inclusão ou edição. O frontend envia uma razão padronizada por operação, enquanto a RPC conserva identidade autenticada, controles de permissão, versão e auditoria do servidor. Ações de arquivamento ainda exigem confirmação.
5. **Cadastro manual** nasce administrativamente ativo; contato pago/publicidade não são automaticamente liberados. Contato, suspensão, RLS e controles de elegibilidade não são modificados.
6. Corrigir o bloqueio do identificador **sintético e estritamente interno** `EUT QA Cadastro Sintetico YYYYMMDD`, validando uma data de calendário real. Os nomes profissionais comuns continuam impedidos de divulgar sequências de oito algarismos, telefones ou links.
7. As respostas de erro devem permanecer seguras (sem eco de telefone ou mensagens brutas da RPC); reconsulta do registro após salvar permanece obrigatória; não repetir automaticamente uma gravação de resultado incerto.

## Limites e decisão de release

- Escopo alterado: componente de formulário, exibição do modal na listagem, guarda de texto público, teste direcionado. **Sem SQL, alteração de RLS, mudança de dados, migrations, novo pacote, merge ou deploy.**
- A RPC atual rejeita ativação imediata na **importação** de origem diferente de `manual`; por isso a criação via editor para `wordpress`/`guiafix` é inicializada inativa neste recorte. A política de importação em massa e a ativação por padrão de históricos requerem decisão/banco específica, preservando as suspensões existentes; não declarar isso resolvido nesta PR.
- Modo de edição de técnicos existentes e ações em lote continuam no painel atual, mantendo suas permissões. Refatoração integral dessas superfícies é outro recorte e não deve ser confundida com o conserto do **Novo técnico**.
- Testes previstos: `vitest run src/lib/admin-technician-manual-modal.test.ts src/lib/admin-technician-registry-contract.test.ts src/lib/admin-technician-intake-contract.test.ts`; depois CI existente e QA 390/1440 do diálogo (foco, Escape, scroll, erro e sucesso) sem criar registros reais.
- **GO para merge** somente com CI verde, QA visual do modal e homologação do salvamento em sessão administrativa legítima em ambiente controlado. Sem autorização de release, manter Draft.

## Reversão

Reverter a PR/commit sem manipular os registros já existentes. Nenhuma migração nem coluna nova exige rollback de banco. O histórico de auditoria gerado em operações administrativas válidas é preservado.
