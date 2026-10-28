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

`wrangler.staging.jsonc` binds only the isolated staging D1/R2 and has no routes, production bindings or
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

## Staging provisioning update (2026-10-28)

Created independent D1 `tsi-overhaul-staging` and verified empty workflow/access
and compatibility tables. R2 `tsi-overhaul-staging-photos` has Public Access
Disabled. No production records or photos copied.

Deployed the procedure-free application to Worker `tsi-forms-staging` using
`node scripts/bundle-dashboard.mjs` and the Cloudflare dashboard code editor.
The bundle embeds only generated reviewed application assets. Both storage
bindings point to the isolated staging resources. Configured the hostname
Access audience and team; preview URLs are disabled. The hostname and Worker
Access applications both use the temporary Block Everyone provisioning policy.
Owner-only access is drafted but not saved pending action-time confirmation.
The CLI configuration retains workers_dev=false as a conservative default.

The actual staging hostname shows the email-code Access login page. At a
390x844 viewport it has no horizontal overflow. This is login-page testing,
not authenticated application acceptance or real-device Safari testing.
All 63 local automated tests pass. Full authenticated work-order, offline,
photo and reporting acceptance remains outstanding.

Private procedure upload remains blocked by automatic approval review pending
explicit payload/destination authorization. No procedure upload succeeded.
Production website, Worker and database were not changed.
