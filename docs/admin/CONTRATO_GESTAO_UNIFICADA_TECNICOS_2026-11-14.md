# Contrato de gestão unificada de técnicos — Encontre um Técnico

**Fonte do requisito:** Henrique Rodrigues, reiterado em 14/11/2026. **Estado:** requisitos consolidados; NÃO declarar CRUD 100% operacional antes da publicação e homologação do backend.

## Regra de negócio central

- Toda pessoa/empresa prestadora importada deve ser tratada pelo painel como **TÉCNICO**. WordPress, Guiafix, cadastro próprio e importação manual são **origens**, não categorias de técnico nem telas concorrentes.
- Administrador pesquisa, adiciona manualmente, importa em lote, edita, corrige, suspende, reativa e exclui de forma auditada pelo próprio painel. Convite por e-mail é opcional para acesso a uma conta, não o mecanismo obrigatório para cadastrar profissional.
- Todo técnico tem identidade administrativa estável, nome original e nome de exibição, histórico de origem, especialidades, categorias, DDD, UF e região, cidades atendidas, contatos privados e histórico de alterações. Campos sem prova devem ficar explicitamente não confirmados, nunca preenchidos com ficção.
- **DDD determina uma região aproximada**, não automaticamente a cidade exata: exemplo 41 → região de Curitiba/PR; 11 → região de São Paulo/SP. Cidade específica só deve ser preenchida se constar na fonte ou for corrigida pelo administrador.
- A diretriz do operador é manter todos os técnicos ativos, exceto os **dois contatos que informou ter suspendido**. Isso é requisito para reconciliação: não aplicar desbloqueio em massa enquanto os IDs e estados desses dois contatos não forem comprovados e preservados.
- O administrador precisa de autonomia completa sobre técnicos, clientes, categorias, serviços, especialidades, regiões, cidades, localidades, conteúdo HTML, SEO e metadados. Exigir autenticação, autorização no servidor, trilha de auditoria, confirmação em operações destrutivas e proteção dos contatos privados.

## Evidência do banco dedicado — leitura em 14/11/2026

| Conjunto | Registros | Interpretação |
| --- | ---: | --- |
| `technicians` | 5 com `status=aprovado` | Contas operacionais existentes, não total de fontes |
| `legacy_review_profiles` | 655 | 385 classificados originalmente como `candidate` e 270 como `employer`; **classificação original ainda precisa ser reconciliada**, sem apagar a proveniência |
| `legacy_public_archive` | 310 | Subconjunto dos 385 candidatos WordPress, não 310 adicionais |
| `eut_legacy_profile_management` | 384 | Sobreposição com os 385 WordPress, não 384 adicionais; inclui 20 registros arquivados |
| Guiafix | 99 nomes públicos | Três capturas com nome e cidade da fonte, sem contatos/DDD comprovados |

Não somar as quatro tabelas WordPress; não alegar 900 técnicos únicos, nem 759 profissionais comercialmente habilitados, até reconciliação dos IDs e contatos. Os 20 exemplos protegidos não podem virar técnicos ativos por inferência. Contatos jamais podem ir para SSR, HTML, log, relatório público ou JSON-LD.

## Interface agora e limites constatados

1. `/admin/tecnicos`: busca unificada pelas três origens com filtros por nome/localidade informada, sem separar a identidade do profissional. As ações existentes de técnico operacional e de acervo WordPress continuam acessíveis, com suas permissões atuais.
2. `/admin` visão geral: identificar explicitamente contas aprovadas versus fichas históricas recuperadas; não apresentar `5` como quantidade absoluta de profissionais.
3. Retirar "Convidar novo técnico ou cliente" da tela principal de gestão de técnicos. Convites para identidade/autenticação permanecem em contas/clientes.
4. A tabela Guiafix atual **não possui os contatos** nem uma associação a `technicians`; uma lista de nomes não equivale a importação operacional.
5. **Atualização da verificação em 14/11:** as RPCs `eut_admin_technician_change` e `eut_admin_technician_archive` já foram encontradas no banco hospedado por consulta somente leitura (assinaturas com `uuid,timestamptz,jsonb,text` e `uuid,timestamptz,text,text`). Isto não prova QA autenticado nem altera autorização para SQL. **Cadastro manual/importação de técnicos sem conta Auth ainda não estão instalados**. A proposta `docs/sql/eut-admin-technician-crud-staging-proposal-20261111.sql` continua sendo código de homologação, não um release.

## Contrato incremental de cadastro e importação sem conta Auth (proposta não instalada)

**Motivo técnico:** `technicians.user_id` é obrigatório e referencia a identidade em `profiles(id)`. Criar conta fictícia em Auth para cada técnico importado seria incorreto. A proposta SQL aditiva introduz `eut_moderation.admin_technician_records`, uma ficha administrativa de técnico sem login, e `eut_moderation.admin_technician_record_contacts` para números privados. Ambos possuem RLS habilitado, sem `SELECT/INSERT/UPDATE/DELETE` concedidos a usuários da aplicação. Não alterar a relação vigente `technicians` → `profiles`.

**RPCs propostas, todas exclusivas para admin com e-mail confirmado e `user_roles`:**

| RPC | Entrada resumida | Efeito no banco e retorno |
| --- | --- | --- |
| `eut_admin_technician_record_save(text,text,timestamptz,jsonb,text)` | origem, ID estável da fonte, versão ou `NULL`, objeto de campos e justificativa | Cria (versão `NULL`), edita (versão exata), reimportação idempotente sem sobrescrever; registra auditoria; retorna `technician_id`, `updated_at`, `created`, `idempotent` |
| `eut_admin_technician_registry_list(text,integer,integer)` | busca, limite 1–100, deslocamento até 100 mil | Página de nomes/DDD/região/IBGE/categorias e últimos 4 dígitos; **nunca** retorna telefone integral |
| `eut_admin_technician_record_archive(uuid,timestamptz,text,text)` | ID, revisão exata, `archive`/`restore` e justificativa | Arquivamento reversível e auditado; restauração recupera `admin_active` anterior do evento de arquivamento, sem ativar contatos privados |

- `origin` = `manual`, `wordpress`, `guiafix` ou `other_import`; é a **origem**, não uma classe de técnico. `source_id` identifica o registro na fonte e não contém telefone/nome privado. Fonte WordPress exige `wordpress_20261108:<wp_post_id>` e consulta `legacy_review_profiles` para aceitar exclusivamente `kind=candidate` e manter os 20 demos inativos.
- `city_ibge_id` pode ser `NULL` quando cidade real não estiver comprovada; `ddd` e `region_approx` são fatos separados. `category_slugs` e `service_slugs` podem estar vazios quando não houver comprovação, mas valores fornecidos devem existir e estar ativos no catálogo.
- `phone_action`: `keep`, `replace` ou `remove`; `replace` só aceita telefone Brasil E.164 e `contact_suspended` explícito. Números bloqueados e duplicados são rejeitados. Um contato já suspenso **não pode ser trocado nem removido para contornar a suspensão**, e a edição de outros campos preserva essa suspensão. **Nenhuma RPC habilita divulgação ou contato pago.**
- Importação pode chamar `record_save` por ID estável em lotes da interface, com idempotência por `origin + source_id`; rollback por transação é demonstrado no fixture. **Importação cria `admin_active=false`, sem ativação em massa**; as duas suspensões alegadas ainda dependem de identificação exata. **Não há ainda uma RPC de importação massiva, vinculação automática ao Auth, deduplicação entre fontes, hard delete nem pipeline validado com 5.000 registros.** Não prometer esses recursos antes de implementados e testados.
- Reversão futura exige apenas desabilitar as novas funções e bloquear leitura/escrita; **não** apagar as duas tabelas, pois conterão dados e auditoria. Para alterações no Supabase hospedado, validar primeiro schema real, cópia de segurança, permissões, funções existentes e casos de rollback, obter autorização específica e executar uma única migração controlada.

## Contrato de aceite para CRUD 100%

- Importação de um CSV/SQL/backup ou outro portal com prévia, deduplicação por ID de origem/telefone privado quando legítimo, processamento em lotes para 5.000+ técnicos, reprocessamento idempotente, relatório de rejeições, sem criar contas Auth artificiais.
- Cadastro manual direto com edição integral de campos, associação opcional a usuário autenticado e status de disponibilidade operacional independente do bloqueio individual de contatos.
- Lista unificada paginada no servidor, com busca por nome, DDD, região, cidade, especialidade, categoria e fonte; sem limite oculto de 5/99.
- Edição, ativação, suspensão e exclusão reversível e permanente por permissões específicas; preservação de pagamentos, solicitações, histórico de titularidade e logs conforme política de retenção.
- CRUD para categorias, serviços, regiões, cidades e metadados/HTML com revisão, validação e auditoria; sem permitir HTML arbitrário e inseguro na publicação.
- Testes de RLS, permissões, concorrência, contato privado, importações de 5.000+ e rollback em **PostgreSQL descartável**; somente depois SQL/RLS auditado e autorizado no projeto hospedado, merge, release e verificação no painel conectado.

**Bloqueio concreto:** esta rodada de código/front-end não dá autorização para executar SQL/RLS no banco hospedado. A publicação do CRUD backend precisa cumprir os gates e a aprovação já solicitada para staging; não converter nomes históricos em perfis comerciais sem contato e identidade reconciliados.

## Atualização normativa — 28/11/2026: gestão de usuários e CRUD 360° inspirado no fluxo WordPress

A referência WordPress é de **funcionalidade e ergonomia**, não de cópia de aparência nem de uma segunda instalação. Esta atualização prevalece sobre as regras históricas de 14/11 que indicavam criação/importação inativa: conforme decisão do proprietário, toda ficha nova administrativa ou importada nasce habilitada (exceto demonstrações), preservando suspensões/arquivamentos existentes e critérios reais de elegibilidade pública. Habilitação administrativa não concede acesso Auth nem publica contato privado.

### Um painel, um fluxo de trabalho

- Uma central `/admin/usuarios` com Todos, Técnicos, Clientes e Administradores; origem WordPress/Guiafix/manual é metadado, não papel. Manter os módulos existentes como editores especializados; não criar outro cadastro ou banco.
- Listagem operacional compacta como referência de navegação: busca global, filtros por papel/situação, paginação no servidor, contador real, ações por linha (visualizar/editar), seleção da página e operações em lote auditadas quando suportadas. Alternativas responsivas de tabela e cartões; 390/768/1440, sem overflow nem alvos inacessíveis.
- Incluir técnico diretamente pelo CRUD existente, sem convite ou conta de login obrigatória. Para conta de cliente/técnico autenticado, distinguir conta Auth, ficha profissional e contato: convite/acesso são etapas próprias. Gestão de administradores protegida; nenhum papel privilegiado por edição comum.
- Abrir editor pela identidade canônica comprovada: `registry:UUID` → editor administrativo e revisão otimista; `account:UUID` → gestão de conta por UUID; `portal:UUID` → editor operacional exato; `wp:kind:ID` → acervo por identidade exata. Uma busca por nome/DDD/telefone NÃO identifica pessoa. `imported:UUID` órfão ou vínculos incoerentes permanecem somente leitura até reconciliação comprovada e operação segura.
- Ações de criar, consultar, atualizar, habilitar/suspender, arquivar/restaurar devem preservar a trilha, idempotência e histórico. Exclusão definitiva somente quando permitida por política e autorização específica; não confundir suspensão, arquivamento e exclusão. Confirmar escrita pela releitura do servidor; mostrar erros recuperáveis, nunca sucesso presumido.
- Contatos completos somente para administrador autorizado, nunca em HTML público, busca pública, analytics, logs ou URLs. Estado da ficha, da conta e da restrição de contato são independentes. Não enfraquecer RLS.

### Micro-rodadas e evidências

1. **Identidade e edição direta:** reaproveitar a PR #479 e o editor auditado existente; registro `registry:UUID` de técnico sem Auth com chave própria confirmada deve oferecer Editar ficha mesmo sem vínculo de importação. O nome só limita a leitura da RPC; a gravação permanece bloqueada até correspondência exata de UUID, origem e revisão. Fechar editor ao mudar filtros/página; após gravação confirmada, reconsultar a lista. Orfãos permanecem somente leitura.
2. **Contas e histórico:** reconciliar a abertura exata de conta/portal/WordPress e retorno à lista, sem correspondência por nome. Reaproveitar #484, #465, #476 e módulos existentes; não presumir que estão publicados.
3. **Operações e escala:** validar criação/edição de clientes e técnicos, contatos, moderação, ações em lote, duplicidades, paginação, ordenação geográfica e escala; instrumentar auditoria e QA autenticado, depois uma release por escopo aprovado.

O documento e os testes de UI com respostas sintéticas não provam CRUD de ponta a ponta no Auth/Supabase oficial. QA deve usar ambiente isolado, casos positivos/negativos, homônimos, UUID incorreto, permissões, concorrência, releitura, rollback e 390/768/1440. Não realizar escrita de teste em produção, aplicar SQL nem liberar privilégios por esta norma. Verificar CI e HEAD; transportar apenas correções aprovadas sobre Production READY atualizado, com rollback e sem merge indiscriminado da main.
