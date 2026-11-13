# Reconciliação offline das três capturas — 12/11/2026

**Escopo:** #200 (base `6a181b4e`), #207 (`ce1d5036`), #208 (`501a0f94`). Cadastro operacional único; origem é filtro/procedência, nunca uma segunda classe de profissionais ou uma listagem externa pública. Nenhuma conta Auth, contato, cobertura declarada, disponibilidade ou técnico ativo é criado.

| Fonte histórica | Cidade/UF | IBGE | Nomes | Blob Git original |
| --- | --- | --- | ---: | --- |
| #200 GuiaFix | Almirante Tamandaré/PR | 4100400 | 33 | `d8d95c2f810c68bb92616d23e6bbe27d84f8bb1e` |
| #207 GuiaFix | Paranaguá/PR | 4118204 | 13 | `ac466697c309981329f6e2fcdbba634fc14f2516` |
| #208 GuiaFix | Cruzeiro do Sul/AC | 1200203 | 53 | `2a1c0b0f3e2f9242d455a73367f9343d097e0570` |

JSONs #207/#208 copiados por referência ao **mesmo blob Git**, sem reconstrução ou recaptura. A documentação original e a implementação visual desativada da #207 continuam recuperáveis na branch histórica, não na proposta integrada. Não afirmar 99 técnicos cadastrados ou ativos.

Apenas as três páginas de categoria GuiaFix, cada qual com seu par cidade/UF/IBGE, são aceitas. Encontrey permanece somente no recorte original de Almirante. Os testes antigos da #200 e os três arquivos de teste exclusivos #207/#208 rodam no mesmo workflow offline; a assertiva da #207 que exigia a antiga UI paralela foi adaptada para exigir a sua **ausência**.

Os cadastros orgânicos seguem as regras existentes de elegibilidade. Habilitação futura de origens externas exige governança, bloqueios, revisão de identidade e confirmação da política vigente; não requer criar uma conta fictícia ou presumir reivindicação como condição universal. Não aplicar SQL, não abrir novas consultas à fonte, não fazer merge ou deploy sem homologação.
