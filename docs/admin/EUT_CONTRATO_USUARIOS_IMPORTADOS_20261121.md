# Encontre um Técnico — contrato único de usuários e importação de grupos

**Decisão do proprietário: 21/11/2026.** Este contrato substitui as exigências anteriores de aprovação individual de perfis importados. Não modifica, por si, regras de autenticação, pagamento, suspensão, bloqueio ou proteção contra acesso indevido a contatos.

## Modelo

1. **Uma pessoa ou empresa = um usuário no catálogo administrativo**, independentemente de origem (cadastro próprio, WordPress, Guiafix, grupos ou outros portais). A origem é proveniência interna, não uma categoria pública.
2. **Papel operacional**: `tecnico` oferece/presta serviços; `cliente` pede atendimento; `administrador` opera o portal com papéis próprios. Um usuário autenticado pode acumular papéis quando o sistema suportar. Não presumir que ter ficha importada equivale a ter sessão/Auth.
3. **Importação ativa por padrão**: novos registros válidos entram habilitados, sem fila de aprovação ou autorização de publicação individual criada pelo software. A reivindicação/primeiro login posterior apenas vincula a conta ao cadastro existente, não o recria.
4. **Campos faltantes não invalidam o usuário**: nome/e-mail podem estar ausentes; identificadores regionais são rótulos provisórios, nunca identidades pessoais inventadas. DDD brasileiro aponta área aproximada/UF, **não** município ou bairro específico; código IBGE só mediante dado de cidade real. Telefone é chave operacional de deduplicação, mas não deve ser exposto em indexadores, logs ou resultados anônimos.
5. **Comercialização**: clientes compram acesso ao contato do técnico. O administrador vê telefones integrais conforme sua permissão; antes do pagamento, o público não recebe contato integral. O desbloqueio pago depende do entitlement real do portal e não deve ser substituído por link público simples.
6. **Exceções operacionais**: registros banidos, bloqueados ou suspensos permanecem nessas condições em importações/reimportações; a importação não os reativa. A elegibilidade pública de um técnico também requer contato utilizável. Todos os demais cadastros importados nascem administrativamente ativos.
7. **Deduplicação**: telefone normalizado BR E.164 e identificador estável por fonte; nunca depender da posição da linha ou do hash do CSV inteiro. Entradas já existentes são preservadas; novo arquivo não sobrescreve mudanças administrativas.
8. **Extensão internacional**: números de Portugal, Moçambique e outros países devem conservar DDI internacional e localização real. **Não** atribuir DDD brasileiro a números internacionais e não criar cidade/país que não conste na fonte.

## Inventário verificado dos arquivos disponíveis (21/11/2026)

- `DOC-20261120-WA0060.zip` (FIELD SERVICE BRASIL) → 401 telefones únicos no CSV previamente extraído, 56 com nome associado a VCF, 345 sem nome vinculado.
- `contatos-grupos-conciliados.csv` (grupos de 05–06/11) → 133 telefones únicos.
- Cruzamento entre arquivos: 20 números repetidos; **514 únicos** no conjunto consolidado, **60 DDDs**.
- Heurística de papel **provisória e editável**: 41 remetentes que somente anunciaram solicitações de serviços e 1 fonte histórica `employer` → `cliente` (42); 472 restantes → `tecnico` em razão da orientação de aproveitar os grupos técnicos. Isso **não é comprovação de profissão, disponibilidade em tempo real ou titularidade**, e o perfil precisa permitir corrigir o papel.
- Conferência inicial com banco oficial antes da importação: 9 telefones já na tabela administrativa de contatos, 0 no contato operacional Auth, 1 número bloqueado, 504 sem correspondência. Somente novos técnicos sem bloqueio devem gerar novas fichas; já existentes permanecem intactos.

## Contrato técnico de integração

- Manter `profiles`/`user_roles` atrelados a contas reais Auth; não fabricar usuário Auth sem login. Cadastro importado ativo é registro administrativo, vinculável à identidade autenticada posteriormente.
- Para técnicos importados, reutilizar `eut_moderation.admin_technician_records` e `eut_moderation.admin_technician_record_contacts`, compatíveis com `eut_public_admin_technicians` e a busca pública. `origin` pode ser `other_import` internamente. E-mails disponíveis em outras origens devem ser preservados na base autorizada; não preencher e-mail inexistente.
- Para clientes importados sem login, registrar como usuários ativos com papel `cliente`, sem criar fichas falsas de técnico. Expor ao dashboard por módulo autenticado e auditado, não pela listagem pública de prestadores.
- Novo técnico sem nome: rótulo provisório `Técnico disponível — DDD NN`; campo `region_approx` `DDD NN — UF` quando UF for inequívoca, ou `DDD 61 — DF/GO`. Não concluir disponibilidade online, especialidade, bairro ou cidade específica a partir do rótulo.
- Manter `admin_active=true` para novas fichas elegíveis. Moderados/bloqueados continuam fora de buscas; não substituir controles existentes. Número visível integralmente só para administrador autorizado e comprador com acesso confirmado.
- A importação deve ser idempotente e auditada, com contadores reais: importados, existentes, bloqueados, falhas, clientes e técnicos. Sem duplicar contatos de compras/histórico, sem novos testes de ponta a ponta indiscriminados, sem deploy desnecessário.

## Pontos que exigem desenvolvimento adicional, não confundir com importação concluída

- Importação administrativa sem Auth **não** cria uma conta capaz de fazer login até a reivindicação/vínculo futuro.
- O fluxo de compra do contato de técnicos importados precisa ser verificado antes de declarar que todos os telefones estão comercialmente desbloqueáveis. Não presumir que entitlement do `technicians` se aplica automaticamente a `admin_technician_records`.
- A visualização unificada no dashboard de clientes/tecnicos precisa ler o índice de usuários importados, respeitando permissões. Registrar usuários no banco não comprova, isoladamente, renderização no painel.

**Privacidade na aplicação:** não há sigilo perante o proprietário/administrador autorizado; isso não equivale a divulgar telefones para buscadores, visitantes não pagantes ou agentes externos.