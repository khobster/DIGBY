# DIGBY /analyze worker

Cloudflare Workers AI backend for DIGBY. Deploy with `cd worker && wrangler deploy`. It needs no API key because it uses the free `env.AI` binding (declared in `wrangler.toml`) rather than an external provider. After deploy, Wrangler prints the live worker URL (e.g. `https://digby-analyze.<your-subdomain>.workers.dev/`); paste that URL into the `ANALYZE_URL` constant in the front-end `index.html`.
