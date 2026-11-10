import { FRIENDLY_ERROR_COPY } from "./friendly-error-copy";

// Independent HTML fallback: this must work even when React, JS and SSR fail.
// Status and copy are trusted constants, never request-derived HTML.
export function renderErrorPage(status: 500 | 503 = 500): string {
  const copy = FRIENDLY_ERROR_COPY[status];
  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex,nofollow" />
    <link rel="icon" href="/favicon.png" type="image/png" />
    <title>${status} · ${copy.label} | Encontre um Técnico</title>
    <style>
      * { box-sizing: border-box; }
      html { color-scheme: light; }
      body { min-height: 100vh; margin: 0; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; background: radial-gradient(ellipse at 50% 10%, #e8f4ff 0, #fff 58%); color: #142c47; display: flex; flex-direction: column; }
      header, footer { width: min(100%, 75rem); margin-inline: auto; padding: 1.5rem 1.25rem; }
      header a { color: #163c67; font-weight: 800; letter-spacing: -.02em; font-size: 1.125rem; text-decoration: none; }
      main { display: grid; place-items: center; flex: 1; padding: 1.25rem; }
      .card { width: min(100%, 36rem); border: 1px solid #dce8f3; border-radius: 1.5rem; background: #fff; box-shadow: 0 16px 60px #1539610c; padding: clamp(1.5rem, 5vw, 3rem); text-align: center; }
      .symbol { width: 5rem; height: 5rem; display: grid; place-items: center; margin: 0 auto 1.5rem; border-radius: 1.25rem; background: #eaf4fc; color: #126aa8; font-size: 2rem; font-weight: 700; }
      .label { font-size: .75rem; text-transform: uppercase; font-weight: 800; letter-spacing: .17em; color: #096aa8; }
      h1 { font-size: clamp(1.75rem, 5vw, 2.25rem); line-height: 1.15; letter-spacing: -.04em; margin: .75rem 0 1rem; }
      p { color: #516579; line-height: 1.7; margin: 0 auto .75rem; max-width: 29rem; }
      .actions { display: flex; flex-wrap: wrap; gap: .75rem; justify-content: center; margin-top: 2rem; }
      .actions a { display: inline-flex; align-items: center; justify-content: center; min-height: 3rem; border-radius: .75rem; padding: .75rem 1.15rem; font-weight: 700; text-decoration: none; }
      .primary { background: #066ba9; color: #fff; }
      .secondary { border: 1px solid #d5e0eb; color: #142c47; }
      .help { border-top: 1px solid #e6edf4; margin-top: 2rem; padding-top: 1.25rem; font-size: .9rem; }
      .help a { color: #066ba9; font-weight: 700; }
      footer { color: #65788a; font-size: .8rem; }
      @media (max-width: 30rem) { .actions { flex-direction: column; } }
      a:focus-visible { outline: 3px solid #f6aa38; outline-offset: 3px; }
    </style>
  </head>
  <body>
    <header><a href="/" aria-label="Encontre um Técnico — página inicial">Encontre um Técnico</a></header>
    <main>
      <section class="card" aria-labelledby="error-title">
        <div class="symbol" aria-hidden="true">!</div>
        <div class="label">${status} · ${copy.label}</div>
        <h1 id="error-title">${copy.title}</h1>
        <p>${copy.description}</p>
        <p>${copy.suggestion}</p>
        <nav class="actions" aria-label="Opções para continuar">
          <a class="primary" href="">Tentar novamente</a>
          <a class="secondary" href="/">Voltar ao início</a>
        </nav>
        <p class="help">Precisa de orientação? <a href="/contato">Fale com a equipe</a></p>
      </section>
    </main>
    <footer>Encontre um Técnico · Precisou? Encontrou!</footer>
  </body>
</html>`;
}
