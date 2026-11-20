# Release controlado — escolha de papel técnico e OTP (#340)

- **Base funcional:** `main` `fe79ff7e521ee0b260d32106c206643542af750c` — PR #340 integrada após corrigir a expectativa de texto do teste.
- **Validação:** HEAD da PR `53d4bd20e196b52935d20db3f323727e5d794a59`, 7/7 workflows GitHub Actions concluídos com sucesso (incluindo CI e Technician auth gate).
- **Contrato:** `choose_account_type` pode atribuir o papel técnico antes do OTP; isso não torna a ficha pública. A comprovação de e-mail e a elegibilidade seguem exigidas pelo servidor na publicação. Nenhum SQL novo foi aplicado.
- **Compatibilidade:** a implementação da PR #343 já está na base, assim como a moderação administrativa integrada na PR #346. O deployment READY anterior foi criado a partir de uma branch de release isolada de #346 e ainda não continha os arquivos da #340; este release parte da `main` consolidada.
- **Segurança:** manter papéis administrativos, RLS, telefones privados, dados e contatos suspensos, além dos critérios existentes de cadastro/publicação.
- **Política de publicação:** prefixo `release:` para acionar o Ignored Build Step existente. Verificar o SHA exato e READY na Vercel antes de confirmar produção. Não alterar DNS ou Supabase.
