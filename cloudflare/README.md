# Protected development application

Run `npm run check` from this directory with Node supporting `node:sqlite`.
The 63 automated tests cover authentication, per-job authorization, immutable
evidence, independent reviews, revision conflicts, offline queue retention,
photo authorization, and application asset isolation.

`node scripts/bundle-dashboard.mjs` creates a standalone dashboard bundle after
the regular build. Only reviewed application assets are embedded. Do not place
confidential content in `public/` or generated application assets.

The Worker requires Cloudflare Access configuration and per-job roles before
serving assets or data. Use only isolated development database and object
storage bindings. Keep preview URLs disabled. The CLI configuration retains
workers_dev=false as a conservative default.

Release/completion is disabled. Customer report output is withheld pending an
explicit disclosure mechanism. Full authenticated acceptance, offline reload,
legacy form integration and real-device testing remain outstanding.
Production deployment and destructive database changes require owner approval.
