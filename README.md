# App template

Runable copies this Bun and Turborepo project into each new sandbox.

The root package commands are the external contract:

- `bun run dev` starts the web app.
- `bun run dev:desktop` and `bun run dev:mobile` start platform clients.
- `bun run build` builds every package.
- `bun run start` starts or restarts the production server.
- `bun run stop` stops the production server.
- `bun run lint` and `bun run typecheck` validate the project.
- The `db:generate`, `db:migrate`, and `db:push` commands manage the database.

Deployment tools depend on these command names. Their implementations may change, but the names must remain stable.

The web package owns the API, database, and shared web interface. The mobile package is an Expo client. The desktop package is an Electron shell around the web app. Services use the fixed ports defined in `__ports.cjs`, and the web health endpoint is `/api/health`.

Secrets belong in the root `.env` file. Browser values must use the `VITE_` prefix. Commands prefixed with `internal:` are for template maintenance.

## Horizonte — painel privado

- `/` tem relógio local e login. O convite inicial é validado no servidor por `OWNER_SETUP_TOKEN`, um valor hexadecimal aleatório de 32 bytes. O convite deixa de funcionar depois do cadastro da conta proprietária. Não use um prefixo `VITE_` no segredo.
- O painel registra mensalidades por competência e dá baixa de pagamentos manualmente. Não cobra nem emite reembolsos.
- Para configurar um domínio próprio, publique pelo Runable, vincule o domínio nas configurações da plataforma e configure `PANEL_CUSTOM_DOMAIN` com a origem HTTPS se `WEBSITE_URL` não refletir o novo endereço. `PANEL_PREVIEW_PROXY_ORIGIN` é específico da prévia.
- Fotografia: [Macau Skyline](https://commons.wikimedia.org/wiki/File:Macau_Skyline_(157820121).jpeg), Mike, [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/). Convertida para WebP e usada com sobreposição de contraste.
