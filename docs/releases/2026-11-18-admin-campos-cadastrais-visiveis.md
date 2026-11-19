# Release — dados cadastrais visíveis na administração

**Data:** 18/11/2026  
**Funcionalidade:** PR #326, merge `65ddbbb12af047fdd94d61176501a35175693bde`.

## Regra do proprietário
Telefone, e-mail, endereço e demais dados disponíveis são informações comuns do cadastro administrativo. Não exigem revelar, justificativa para leitura, ocultação por tempo ou máscara para administradores confirmados.

## Entrega
- Em `/admin/tecnicos`, ficha 360° e `/admin/contatos`: telefone integral apresentado como dado do cadastro, quando existente, com possibilidade de copiar.
- Editor administrativo: campo de telefone preenchido com o número atual e alteração pela operação já auditada.
- Contatos suspensos são consultáveis sem remover suspensão nem habilitar contato ao cliente.
- Acesso público, pagamento, RLS, bloqueios e dois suspensos preservados.
- Funções `eut_admin_unified_contact` e `eut_admin_contacts_dashboard` atualizadas no Supabase oficial antes desta publicação. SQL de referência: `docs/sql/eut-admin-contact-fields-20261118.sql`. **Não reaplicar automaticamente.**
- E-mail de contas Auth já constava no painel; endereço completo e e-mail dos registros importados dependem da existência/gestão desses campos e não são inventados.

## Publicação
Commit `release:` ativa o Ignored Build Step existente do projeto Vercel `encontreumtecnico`, sem alterar a configuração. Apenas o deployment READY com o SHA deste release poderá assumir os aliases de produção.
