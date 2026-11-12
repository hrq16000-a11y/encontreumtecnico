# Contrato P0 — alterações administrativas auditadas (pré-implantação)
**Data:** 2026-11-11 · **Relacionado:** PR #209 e Issue #210  
**Estado:** somente contrato, validação offline e proposta de servidor. **Não aplicado ao Supabase.**

## Resultado da verificação somente leitura

- O projeto tem `eut_admin_contacts_dashboard`, `eut_admin_contact_reveal`,
  `eut_admin_contact_action` e `eut_admin_technician_action`.
- `eut_admin_technician_action('editar')` aceita somente `display_name`,
  `bio`, `region`. Não edita telefone, município-base, bairro, cobertura ou serviços.
- O RLS de `technicians` possui `Admin moderates` para UPDATE, mas o
  gatilho `eut_admin_audit_technician` só registra mudanças em
  `status/display_name/bio/region`. **UPDATE direto de cidade/serviços/cobertura
  não satisfaz a auditoria** e portanto fica proibido nesta etapa.
- `eut_technician_private_contacts` possui checagem E.164 Brasil e gatilho de
  rejeição de números restritos. Não há RPC administrativa existente para
  trocar/remover o contato completo.
- O catálogo oficial contém municípios por ID IBGE. O banco impõe até 5
  municípios, raio opcional entre 5/10/20/30/50/75/100/150/200/300 km,
  máximo de 64 serviços, validação de categorias e serviços ativos, e
  contato público proibido em bio/região/bairro.
- `eut_set_my_technician_coverage` é explicitamente do **próprio técnico**,
  exige conta confirmada e publicada; não substitui uma RPC administrativa.

## Entregável desta micro-rodada

`src/lib/admin-technician-crud-intent.ts` com testes sintéticos:
normalização de telefones, cidade-base oficial, regiões adicionais, raio,
categorias/serviços, bloqueios, revisão otimista e prévia de arquivo reversível.

**`kind: preview_only` significa que nada foi persistido.** A biblioteca
não concede privilégios; a UI só poderá oferecer **Salvar/Excluir** depois de
operações administrativas reais, autorizações e testes de integração.

## Contrato recomendado do servidor (requer aprovação e homologação separadas)

**Operação transacional proposta** (não existente):
`eut_admin_technician_change(_technician_id uuid, _expected_updated_at timestamptz, _payload jsonb, _reason text) RETURNS jsonb`

1. Revalidar `auth.uid()`, sessão/admin verificado e papel `user_roles` no servidor,
   nunca por metadata editável. Bloquear identidade nula. Fixar `search_path` e
   privilégios `EXECUTE`; manter tabelas privadas fora de APIs anônimas.
2. `SELECT ... FOR UPDATE` do técnico e comparar `updated_at` recebido com
   versão atual: se divergente, **conflito**, não sobrescrever.
3. Resolver `base_city_ibge_id` diretamente de `eut_ibge_municipalities`; gravar
   nome canônico + UF. Nunca aceitar cidade livre.
4. Quando mudar cidade-base, o gatilho existente **zera a cobertura**. A função
   deve aplicar a nova cidade primeiro e, dentro da **mesma transação**, validar
   e gravar novamente a lista multi-IBGE (1–5, incluindo base) e raio. Não
   executar updates independentes em browser.
5. Validar serviços ativos e pertencentes às categorias ativas selecionadas,
   sem duplicação, limite 64. Usar as validações já existentes do banco.
6. Telefone: normalizar Brasil E.164 e verificar `blocked_phones`, conta
   bloqueada, duplicidade e o gatilho de restrição. `replace` grava somente
   em `eut_technician_private_contacts`; `remove` retira contato da tabela
   privada por função administrativa auditada, sem apagar conta; `keep` não
   altera. **Nunca** redefinir banimentos ou ativar divulgação implicitamente.
7. Registrar auditoria **na mesma transação**, antes/depois dos campos
   alterados, com `actor_id`, justificativa sanitizada, ID do técnico,
   códigos IBGE e slugs, flags de telefone alterado e final 4 dígitos.
   **Não** persistir telefone integral, JWT ou material de autenticação na trilha.
8. Qualquer erro implica rollback total; não permitir atualização parcial
   entre técnico, cobertura, contato e log. Responder versão nova e ID
   confirmado. Repetir o mesmo comando com mesmo token de idempotência
   não deve repetir alteração.

**Arquivamento reversível proposto** (não existente):
`eut_admin_technician_archive(_technician_id uuid, _expected_updated_at timestamptz, _action text, _reason text) RETURNS jsonb`

- `archive`: guardar marcador reversível e estado original em schema privado
  de moderação, suspender exibição, bloquear contato liberado e registrar auditoria
  na mesma transação. Preservar conta, histórico de pedidos, banimentos e dados
  necessários à retenção legal.
- `restore`: retirar marcador de arquivo, voltar exclusivamente para
  `pendente` (nunca aprovar nem habilitar divulgação automaticamente); manter
  bloqueios e exigir revisão administrativa para eventual publicação.
- Não implementar hard delete agora. Tratamento de exclusão definitiva demanda
  retenção, dependências de pedidos, solicitação do titular, confirmação dupla e
  política de restauração/backups.

## Testes obrigatórios para liberar o backend

1. Anônimo, cliente e técnico não administradores: **42501** para todas as
   novas RPCs. Admin: sucesso apenas para registros permitidos.
2. Duplicidade/banimento de telefone: impedir publicação e divulgação, preservar
   banimento após edição e depois de restauração do arquivo.
3. Dois administradores concorrentes: segundo recebe **conflito** por versão,
   sem sobrescrever rascunho do primeiro.
4. Falha simulada entre atualização de contato e gravação de auditoria:
   rollback integral. Auditoria nunca recebe telefone integral.
5. Mudança de cidade-base: gatilho limpa cobertura anterior; mesma transação
   grava apenas cobertura oficial reconfirmada. UF/bairro e raio consistentes.
6. Desativação de serviço/categoria no catálogo entre prévia e execução: servidor
   recusa operação; navegador não decide autorização final.
7. Arquivar e restaurar sob conta ou telefone banido: permanece não publicado.
8. SSR/noindex das páginas privadas, mobile, Alt+Tab, recarga, histórico,
   rascunhos isolados, segurança pública e testes sem tocar em usuários reais.

## Governança

- Não criar `supabase/migrations/*` ou `drizzle/*` nesta branch: `AGENTS.md`
  reserva essas alterações ao fluxo de banco do projeto.
- Não executar SQL de escrita, nem invocar RPCs administrativas reais nesta rodada.
- Publicar painel completo somente após operação de servidor comprovada em
  staging isolado, gates verdes no HEAD e autorização.
- PRs #193, #200, #205, #207, #208 e #209 continuam independentes.
- Nenhuma consulta a GuiaFix/Encontrey será feita neste trabalho.
