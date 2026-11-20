# Homologação local do contrato Mercado Pago (proprietário EUT)

Executa `docs/sql/eut-mp-owner-settings-20261120.sql` em PostgreSQL **17**, com
`auth` e funções dependentes substituídos por fixtures **100% sintéticos**.
Não acessa Supabase, não usa credenciais oficiais, não altera checkout e não
cria cobranças. A base temporária é descartada ao final, inclusive se um teste
falhar. O processo escuta só em `127.0.0.1` e desativa socket Unix.

## Executar

Requer Node.js, npm e os binários locais de PostgreSQL (pacote
`embedded-postgres` disponível para a plataforma Linux x64 deste teste).

```bash
MP_PG_PACKAGE_ROOT="$(mktemp -d)"
npm install --prefix "$MP_PG_PACKAGE_ROOT" --no-audit --no-fund \
  embedded-postgres@17.11.0-beta.19 pg@8.23.1
MP_PG_PACKAGE_ROOT="$MP_PG_PACKAGE_ROOT" node tests/payments/mp-owner-settings.local.mjs
MP_PG_PACKAGE_ROOT="$MP_PG_PACKAGE_ROOT" node tests/payments/mp-quote-snapshot.local.mjs
```

Execute da raiz do repositório. `MP_PG_PACKAGE_ROOT` é **somente** uma pasta
descartável de pacotes PostgreSQL locais, nunca um endpoint Supabase. Remova
manualmente a pasta de pacotes quando terminar; o script remove sua base
temporária. Nenhuma variável de produção é necessária.

## Contratos exercitados

- Pré-requisitos mínimos sintéticos de Auth, sessão, função de papéis e
  proprietário reivindicado.
- RLS de ambas as tabelas, revogação de acesso direto e execução de RPCs.
- Isolamento entre proprietário, segundo admin, cliente e anônimo.
- Rejeição de sessão trocada/expirada, conta desativada, e-mail não confirmado e
  propriedade não reivindicada.
- Estado inicial desativado, edição válida, leitura em outra conexão, auditoria,
  validações, versão obsoleta, rollback atômico e concorrência real de duas
  transações (lock de linha e prevenção de atualização perdida).

Isto homologa **somente o SQL do contrato isolado**, não a integração de cobrança
ou aderência ao esquema integral do projeto oficial. Nenhuma aprovação para
aplicar o SQL ao Supabase de produção está implícita.

## Resolvedor privado de cotações

O segundo teste instala, **somente em uma base descartável**, a proposta
`docs/sql/eut-mp-quote-snapshot-20261120.sql` depois do contrato do proprietário.
Valida o preço e a versão atômicos, horário de São Paulo nas bordas, alteração
auditada de valor/horário/limite, desativação, transação ainda não confirmada e
recusa a `anon`/`authenticated`. O resultado preserva
`payment_available=false` e `contact_released=false` em qualquer estado.

**Ainda não conectado ao fluxo real:** a definição integral atualmente instalada
de `eut_contact_access_quote(uuid)` não está versionada aqui. Antes de substituir
qualquer RPC, conferir seu contrato completo, manter seus gates de cliente e
elegibilidade, e executar novamente testes isolados. A pré-reserva existente
usa preço fixo e tem `CHECK (quoted_price_cents in (999,2999))`; portanto, também
precisará de alteração compatível antes de permitir preços editáveis. A cotação
final deve invocar o resolvedor com `now()` do servidor e o pré-pedido deve
revalidar preço e versão, sem receber valores do navegador. Nenhum direito pago
ou contato de técnico é liberado nesta etapa.
