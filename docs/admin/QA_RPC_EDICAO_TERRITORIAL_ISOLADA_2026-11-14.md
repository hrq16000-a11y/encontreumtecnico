# RPC administrativa territorial — homologação isolada

**Escopo:** `eut_admin_technician_catalog_edit` (proposta em `docs/sql/eut-admin-technician-catalog-edit-20261114.sql`).

**Ambiente:** PostgreSQL 18.6 em PGlite 0.5.16, apenas em memória, com contas, municípios IBGE, catálogo de serviços, papéis e técnicos **sintéticos**. O teste replicou as validações essenciais dos gatilhos existentes de município/cobertura, serviços e `updated_at`; não foi ligado ao Supabase remoto. Não houve cobrança de projeto/branch, migração hospedada, uso de contatos privados, deploy ou merge.

## Execução local

**18 cenários aprovados, 0 reprovados.** A RPC versionada foi efetivamente criada e chamada no PostgreSQL isolado (não foi apenas inspecionada como texto).

| Área | Evidência | Resultado |
| --- | --- | --- |
| Permissões | `anon` sem EXECUTE, chamada anônima barrada; sem sessão, papel não-admin e administrador não confirmado barrados | PASS |
| Restrições | Administrador bloqueado e técnico bloqueado não recebem edição | PASS |
| IBGE | ID municipal inexistente rejeitado; cidade-base não pode ficar fora da cobertura de perfil aprovado | PASS |
| Categorias/serviços | Especialidade inativa ou duplicada e serviço de categoria incompatível rejeitados | PASS |
| Concorrência | Versão (`updated_at`) obsoleta rejeitada com SQLSTATE `40001`, inclusive após uma escrita bem-sucedida | PASS |
| Auditoria/atomicidade | Falha induzida no INSERT da auditoria (`23514`) reverteu todas as mudanças da transação | PASS |
| Escrita válida | Mudança sintética Curitiba/PR → São Paulo/SP com códigos IBGE oficiais, cobertura coerente e raio redefinido | PASS |
| Privacidade do log | Uma única auditoria antes/depois, sem telefone, e-mail, senha ou pagamento | PASS |

Os testes focados de frontend/validação já presentes no repositório também passaram anteriormente: **23/23** em quatro suítes Vitest, sobre o mesmo contrato de RPC.

## Limite da conclusão

A **homologação local isolada está concluída**. Este resultado não substitui um ensaio em *staging* com as migrações, os RLS e os gatilhos exatos do projeto hospedado, nem os gates completos de build/integração. Não foi criada branch Supabase: não havia staging existente e uma nova branch pode gerar custo. A RPC segue **não instalada** e o botão de edição continua desabilitado por padrão até a aprovação dos gates exigidos.

Não houve alteração de `main`, tabelas, contatos privados, RLS, pagamentos, DNS ou produção.
