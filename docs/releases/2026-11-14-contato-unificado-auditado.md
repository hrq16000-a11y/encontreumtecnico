# Release — contato auditado da ficha unificada — 14/11/2026

- Integração de código: PR #290, commit `5553f58975b8066ae1a1ea64f5b28ca4219063a2`.
- Gate EUT admin consolidated release: SUCCESS no HEAD `784e03da970a8748757feef63e4bfea8f8f64444`.
- Supabase dedicado `pqtzhctvjbfcunmrvxne`: nova função `eut_admin_unified_contact` aplicada, confirmada e verificada com consulta/revelação auditada em transação revertida.
- Privacidade: somente administrador confirmado pode consultar; `anon` sem EXECUTE; motivo obrigatório para mostrar número; ocultação da UI em 60s/saída da aba.
- São consultáveis, quando existentes, números de contas do portal, cadastros administrativos e técnicos históricos do acervo. Nenhum número foi copiado, publicado, alterado ou colocado em HTML SSR.
- A base histórica tem 385 fichas candidatas e 72 com telefone privado; disponibilidade consultada por ficha, sem distinção visual de origem.
- Sem alterações de DNS, RLS existente, dados ou contatos suspensos.
- Esta liberação utiliza o prefixo `release:` exigido pelo Ignored Build Step. Verificar SHA/READY/URL oficial após publicação.
