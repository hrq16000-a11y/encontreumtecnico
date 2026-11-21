# Central de Configurações — micro-rodada 1 (proposta não publicada)

Fonte: `main` 28ffb3a3, 20/11/2026. Os controles encontrados no código não equivalem a QA autenticada de produção.

| Recurso | Controle existente | Situação desta rodada |
| --- | --- | --- |
| Técnicos/contas | `admin-technician-unified-directory`, `admin-accounts-manager` | CRUD e moderação já possuem RPCs; **não alterar** |
| Catálogo | `eut-admin-manager` | Criar/editar e `active` em categorias/serviços; **não alterar** |
| Patrocínios | `admin-advertising-manager` | Criar/editar/aprovar/pausar com RPCs; **não alterar** |
| Prova social da Home | `home-public-proof` | **Novo:** interruptor proprietário em `/admin/configuracoes` |
| FAQ/Home/editorial geral | Código das páginas | Sem editor persistente geral; **fora de escopo** |
| Solicitações, pagamentos e contatos | RPCs e gates próprios | Não possuem chave mestra nova; **fora de escopo** |

## Contrato unitário

- Uma flag privada, `home_public_proof`, criada como `true`, para preservar a Home atual ao instalar o SQL.
- A Data API só expõe o booleano de leitura via `eut_home_public_proof_visible()`; `anon` nunca escreve.
- A escrita usa `eut_admin_set_home_public_proof(boolean,boolean,text)`: `auth.uid()` e `sub` compatíveis, sessão ativa em `auth.sessions`, papel `admin`, conta operacional, e identidade reivindicada no `eut_migration.project_owner_bootstrap`, com e-mail confirmado correspondente. **Outro admin não equivale ao proprietário.**
- Conflito de estado impede sobrescrita silenciosa; justificativa de 8–240 caracteres; toda alteração real escreve auditoria privada na mesma transação.
- RLS ativa e sem acesso direto `anon`/`authenticated` às tabelas, incluindo histórico. Nenhum telefone, ficha, suspenso ou dado de pagamento é lido/escrito.
- A Home não busca nem renderiza a prova social quando a flag é `false` ou não pode ser confirmada. O painel só anuncia gravação depois da releitura.
- Rollback próprio revoga a escrita e restaura a exibição anterior sem apagar configurações nem auditoria.

## Gates antes de integrar/publicar

1. Testes de UI e contrato local PostgreSQL/GoTrue com duas identidades sintéticas: dono, admin não proprietário, `anon`, bloqueio, concorrência, RLS e contagem de auditoria.
2. Comparar SQL com as definições vigentes e verificar preflight, grants e owner bootstrap no Supabase oficial **somente quando o acesso de leitura estiver autorizado**. Não aplicar SQL nesta PR automaticamente.
3. Homologar com a sessão legítima do proprietário: desabilitar, reler após recarga, conferir ocultação pública, reabilitar, reler, observar auditoria. Sem testar em terceiros.
4. Só após gates reais e autorização de mudança de schema, avaliar merge e um único release. Nunca fazer deploy da UI antes do SQL compatível.
