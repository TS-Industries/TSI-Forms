# Protected development application

No production deployment or database changes are authorized by this checkpoint.

## Build and verify

Run `npm run check` from this directory. Node must support `node:sqlite`.
The build deletes its generated `dist` directory and copies only `public/` and
`src/outbox.mjs`. It never packages root legacy HTML, manuals, procedure exports,
work-order records or photos. Do not place confidential content in `public/`.

## Current development features

- Cloudflare Access JWT validation before every asset, API and photo request.
- Per-work-order roles; immutable evidence events and idempotent retry.
- Shared evidence history and operation state with revision conflict checks.
- Independent evidence reviews tied to the original component and actor.
- IndexedDB evidence queue, account/work-order isolation, reconnect retry and
  retained conflicts. The shell must already be open for offline capture;
  offline reload and photo queuing are not implemented.
- Internal JSON reports restricted to verifier/admin. Customer preview contains
  no job content until an explicit disclosure approval mechanism is implemented.
- Release/completion stays disabled pending validated gates and procedures.

The application shell is separate from existing production forms. It does not
establish preservation or migration of all legacy browser and database records.
Stored-HTML report viewers are excluded from this build.

## Staging requirements

`wrangler.staging.jsonc` intentionally has no routes, production bindings or
public development URLs. Configuration fails closed until Access is configured.
Provision an independent staging D1 and private R2, apply reviewed additive
schemas there, configure explicit Access identities and per-job roles, and
verify denial of anonymous requests at the actual staging origin. Never point
writable staging bindings at production. No deployment command has been run.

Private procedure content must live in a verified private repository/service,
separate from public source and generated application assets. This shell does
not include a procedure delivery implementation.

## Validation limits and remaining work

Automated tests use in-memory SQLite and mocked requests/storage. Real Cloudflare
D1/R2/Access integration, desktop/mobile browser acceptance, offline reload,
legacy form integration, procedure validation, photo queueing and final release
gates remain outstanding. Customer report generation is intentionally withheld.
Production cutover and destructive database operations require owner approval.
