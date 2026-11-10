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
      html { color-scheme: dark; }
      body { min-height: 100vh; margin: 0; display: flex; flex-direction: column; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; background: radial-gradient(ellipse at 75% 12%, #184967 0, transparent 44%), linear-gradient(135deg, #112b44, #09192b); color: #fff; }
      header, footer { width: min(100%, 75rem); margin-inline: auto; padding: 1.5rem 1.25rem; }
      header a { color: #fff; font-weight: 800; letter-spacing: -.03em; font-size: 1.15rem; text-decoration: none; }
      main { display: grid; place-items: center; flex: 1; padding: 2rem 1.25rem; }
      .card { width: min(100%, 46rem); text-align: center; }
      .symbol { width: 2.5rem; height: 2.5rem; display: grid; place-items: center; margin: 0 auto .65rem; border-radius: 100%; background: #13496c; color: #8be3ff; font-weight: 700; }
      .label { text-transform: uppercase; font-size: .8rem; font-weight: 800; letter-spacing: .15em; color: #85dffc; }
      h1 { font-size: clamp(2rem, 5vw, 3rem); line-height: 1.14; letter-spacing: -.04em; margin: 1rem 0 1.3rem; }
      p { color: #dfedf6; line-height: 1.7; margin: .7rem auto; max-width: 33rem; }
      .actions { display: flex; flex-wrap: wrap; gap: .75rem; justify-content: center; margin-top: 2rem; }
      .actions a { display: inline-flex; align-items: center; justify-content: center; min-height: 3rem; border-radius: .75rem; padding: .75rem 1.4rem; font-weight: 750; text-decoration: none; }
      .primary { background: #17b7e9; color: #071d31; }
      .secondary { border: 1px solid #819bb0; background: #ffffff13; color: #fff; }
      .help { margin-top: 2rem; font-size: .9rem; }
      .help a { color: #85dffc; font-weight: 700; }
      footer { border-top: 1px solid #ffffff26; color: #acc9dd; font-size: .8rem; }
      @media (max-width: 30rem) { .actions { flex-direction: column; } }
      a:focus-visible { outline: 3px solid #8be3ff; outline-offset: 3px; }
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
