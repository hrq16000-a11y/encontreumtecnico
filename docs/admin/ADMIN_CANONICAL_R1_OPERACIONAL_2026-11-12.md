# Admin Canonical R1: primeiro módulo operacional — PR #256

**Escopo:** a UI em `/admin/tecnicos` implementa o mesmo registro `public.technicians.id` da proposta SQL, sem criar um catálogo paralelo. O frontend usa apenas o cliente publicado Supabase com sessão Auth e autorização revalidada em todas as RPCs.

O backend `eut_admin_catalog_list` permite páginas de até 50 registros e leitura de IDs específicos, sem devolver **número privado**, `source_key`, chave de origem nem titularidade Auth. A busca é por nome; o contador, estado operacional, presença de contato e último evento de auditoria vêm do servidor.

**Fluxo de criação:** escolher nome e/ou telefone, município oficial opcional, categoria ativa opcional e motivo; RPC de criação retorna UUID. A tela consulta **o UUID novamente por RPC** e exige estado e auditoria confirmados. Um erro ambíguo não autoriza repetição automática: a chave manual é mantida até a confirmação. Nenhum telefone fica em storage.

**Importação:** JSON explícito, máximo 50 por transação, com `origin/source_key` únicos por lote; chamada a RPC transacional; leitura por IDs de todos os resultados antes de declarar sucesso. Os nomes/telefones não ficam em logs nem em `localStorage`.

**Habilitar/desabilitar:** usa versão `updated_at`, motivo, confirmação explícita; RPC administrativa com gatilho de auditoria, seguida de releitura pelo ID. Uma tentativa concorrente é bloqueada no servidor. Este estado **não** equivale a publicação pública, aprovação antiga ou contato pago.

**Gate de disponibilidade:** enquanto `eut_admin_catalog_list` não existe no Supabase hospedado, a tela mostra SOMENTE a informação de bloqueio, sem formulário ou controles falsamente funcionais. **A SQL nova não está instalada**; isto é uma implementação em branch para homologação, não uma função atualmente operacional.

**Faltam:** homologação integral em staging dos gatilhos/RLS/categorias/tipos, migração formal com rollback, QA owner autenticado em 390/1440px, decisões sobre publicação pública sem Auth, fluxo de alteração completa (nome, categoria, cobertura e contato), importação operacional em UI amigável para volume nacional e ciclo de liberação após pagamento. Preservar todas as branches e dados históricos.

Sem SQL Supabase real, sem merge/deploy, sem DNS/WordPress/Lovable/produção.
