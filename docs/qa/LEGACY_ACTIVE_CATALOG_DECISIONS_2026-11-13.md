# Regra de negócio — técnicos históricos ativos sem reivindicação obrigatória
**Decisão do proprietário em 13/11/2026.** Escopo: portal Encontre um Técnico. Proposta de integração, não autorização implícita para SQL hospedado, upload de telefones, publicação ou cobrança.

## Apresentação pública única — esclarecimento do proprietário em 13/11/2026
**Todos são simplesmente técnicos.** A origem WordPress, pioneiro, legado ou cadastro novo é metadado **interno**, útil somente para reconciliação, auditoria e gestão; não é categoria, selo de valor, status de atendimento, ordem de prioridade ou texto exibido ao cliente. O administrador pode ver a procedência para corrigir dados, mas não deve tratar o profissional como menos válido por sua origem.

Publicamente, usar somente **Técnico**, nome legível sugerido quando seguro (sem alegar identidade verificada), área/serviços realmente conhecidos, estado de elegibilidade autorizado e contato privado. Não exibir selo Bronze automático, “histórico WordPress”, “pré-cadastro”, número de post antigo ou CTA de reivindicação em cartão/listagem/perfil. Quem tem telefone privado válido, origem auditável e nenhum bloqueio explícito participa do **mesmo** catálogo operacional, independentemente de login/reivindicação. O campo técnico `catalog_origin` nunca é parte do DTO público. Não inventar município via DDD.

O componente auxiliar da lista separada ainda existe no código por dependência de migração; remover seus rótulos diferenciais é uma correção visual **intermediária**, não substitui o cutover para uma única fonte de busca, nem declara dados hospedados ativados.

## Por que a experiência atual está errada
A rota pública ainda exibe um snapshot `legacy_public_archive` como “Pioneiro Bronze · pré-cadastro”, com recuperação como CTA. Essa coleção, com 310 registros no print do proprietário, **não é** a fonte operacional `public.technicians`. O proprietário informa que existem mais de 900 técnicos antigos no backup WordPress; o total e os telefones válidos precisam ser conciliados, sem supor que os 310 representam o universo.
A falta de vínculo Auth ou de reivindicação não transforma técnico antigo em inativo. As propostas #255 (busca) e #256 (R1/R2) já provaram o caminho local, mas ainda não foram liberadas no backend e frontend hospedados.

## Regra funcional aprovada
1. Todos os registros WordPress **com telefone privado válido e procedência auditável**, sem bloqueio ou desabilitação explícitos, devem nascer habilitados no **mesmo catálogo operacional** dos novos técnicos, inclusive sem Auth próprio. Não exigir aprovação individual, login, reivindicação ou preenchimento de perfil para ofertar atendimento.
2. Número ausente/inválido, duplicação não resolvida, bloqueio ou desabilitação são **exceções específicas** a registrar; não aplicar bloqueio em massa por legado. O status herdado `pendente` não é veto operacional; a RPC R2 é a fonte de elegibilidade.
3. “Ativo no catálogo” significa elegível a receber oportunidades; não afirmar “online agora”, atendimento imediato ou identidade verificada sem sinal próprio. Telefones, emails e dados de procedência ficam privados até o fluxo autorizado de acesso ao contato.
4. Os cinco cadastros orgânicos recentes continuam com seus filtros/categorias declarados. Para os antigos, a categoria genérica **Informática** pode ser usada como informação de origem declarada pelo proprietário; nunca inventar especialidade específica, bairro, município IBGE, cobertura ou GPS.
5. Preservar o **apelido original** WordPress de forma imutável. Exibir nome mais legível como **sugestão, não identidade verificada**. Se nome foi alterado pelo titular, prevalece o nome declarado. Não inferir origem a partir de selo Bronze, slug ou grafia.
6. Um DDD pode sustentar apenas **região aproximada**, porque cobre múltiplos municípios e não prova onde o técnico atende. Não converter DDD em cidade exata para os filtros IBGE. A localidade será completada pelo técnico, quando quiser.
7. Reivindicação/vínculo não é tarefa pública de todo histórico. Só oferecer **opção** quando alguém iniciar cadastro de técnico ou recuperação de acesso e a prova de posse do telefone corresponder a um registro. Mensagens de correspondência não podem revelar a existência de telefone antes da autenticação/verificação, nem abrir dados privados por simples conhecimento do número. O cadastro/recuperação segue como perfil novo, com associação opcional auditada ao registro histórico, sem duplicar oferta.
8. Fotos históricas: aproveitar cópia do MySQL e mídias WordPress para gerar **candidatos de associação** via post/attachment/autor, horários de cadastro e de upload, caminho e metadados; correspondência por horário sozinha não basta. Manter trilha (fonte, confiança, motivo), revisão para ambiguidades e fallback de avatar sem publicar arquivo não associado com segurança.

## Comportamento público de aceitação
- Busca única `/tecnicos` e perfil por slug mostram técnico antigo elegível com rótulo profissional, sem CTA obrigatório de reivindicação, telefone privado.
- Sem telefone, bloqueado, desabilitado, sem origem auditável ou fora da elegibilidade: ausente da oferta e 404 de perfil; situação guardada no admin para correção, nunca descartada.
- Número/DDD não é exposto nem inferido como cidade. Localização e especialidade que não foram declaradas aparecem honestamente como não informadas.
- Sem duplicidade entre histórico e ficha operacional; acervo read-only permanece só para rastreabilidade até reconciliação, sem classificar ativos como pré-cadastros dependentes de aprovação.
- Novos 5 técnicos continuam seus próprios campos, filtros, política de visibilidade e UX.

## Plano curto e verificável
1. **Inventário seguro** do backup (contagens por origem, telefone válido, duplicado, bloqueio, foto associável), sem publicar PII. Confirmar se dump MySQL e pasta de `uploads` estão acessíveis neste trabalho.
2. **Dry-run de importação** em fixture local, mapeando WordPress → `technicians` + contatos/procedência privados, idempotência e negativos. Nenhum município IBGE inventado.
3. **Homologação e plano de rollback** de schema/RLS/RPC em staging autorizado. Conectar nomes/fotos preservados somente após vínculo de origem provado; remover a experiência pública de acervo duplicado quando o catálogo estiver ativo.
4. **Publicação separadamente autorizada** após gates e QA; conferir contagens e busca/perfis reais, sem exposição de contato ou pagamento prematuro.

## Questões pendentes (sem bloquear preparação)
- Onde está a versão acessível e autorizada do backup **MySQL e `wp-content/uploads`** para reconciliação de IDs/fotos? Os prints não contêm essa relação.
- O proprietário confirma usar **“Região aproximada do DDD”** quando não houver município declarado, sem atribuir cidade exata?
- A categoria genérica inicial será **“Informática”** para todos os antigos com telefone válido, mantendo serviços específicos como não informados?

## Trabalho realizado nesta branch
- A branch `fix/pioneer-readable-aliases-20261113` já contém a apresentação de nomes sugeridos, preservando apelido original.
- O commit `4da78674` remove do acervo o rótulo de “pré-cadastro pioneiro” e o CTA massificado de reivindicação, mantém contato privado e esclarece que o acervo não determina elegibilidade. **Não torna os cadastros elegíveis por si só**; a ativação depende do catálogo/R2 e importação real com gates.
- Base observada no início desta rodada: `main dc75adf5`, #255 `9aa43cc7`, #256 `df6ac1df`. Teste SSR/PostgREST local da #255/#256 passou em run `43387387531`; workflow temporário removido.

### Complemento de implementação
Em `d3460cab` (branch isolada), os cartões do acervo deixaram de exibir a origem ou qualquer distinção pública, usando apenas “Técnico”, sem reivindicação nem exposição de telefone. Os exemplos `almeidathiagosantos5 → Almeida Thiago Santos` e `alexpaixao13 → Alex Paixao` já constam nos testes sintéticos do helper de nomes. A apresentação ainda não foi publicada.
