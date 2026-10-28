# Snapshot verification

Checks recorded in the isolated source copy on 2026-10-28. These results are not a production certification.

| Directory | Command | Result |
| --- | --- | --- |
| `.` | `npm ci --ignore-scripts --no-audit --no-fund` | Passed |
| `.` | `npm run typecheck` | Passed |
| `.` | `npm run lint` | Passed |
| `.` | `npm test` | Passed |
| `.` | `npm run build` | Passed |

Python application files passed syntax parsing. This does not execute imports, launch the desktop UI, contact a portal or validate an external integration.

The initial export omitted a source folder named `backup`; it was restored from the read-only original. The final type check, 40 unit tests and production build passed. Browser/offline/device behavior was not exercised.

## Publication boundaries

- Operational sources remained read-only; only isolated copies were prepared.
- No corporate service, real-record import, live notification or production database was invoked.
- No deployment command, deploy workflow or new hosting integration is part of this update. Included Vercel configurations disable Git-driven deployments.
- New source imports exclude local environments, databases, generated outputs and operational documents.
- Existing Git history is preserved. Historical public names or assets may remain in old commits; current snapshots use neutral public presentation.

## Production npm dependency audit — my-workout

`npm audit --omit=dev --json` reported 1 critical, 9 high, 0 moderate, 0 low findings in the installed dependency tree on 2026-10-28. Counts include transitive packages and do not establish exploitability in this application.

| Package | Severity | Direct dependency |
| --- | --- | --- |
| `@serwist/build` | high | No |
| `@serwist/next` | high | Yes |
| `@serwist/webpack-plugin` | high | No |
| `brace-expansion` | high | No |
| `browserslist` | high | No |
| `nanoid` | high | No |
| `next` | critical | Yes |
| `sharp` | high | Yes |
| `source-map-js` | high | No |
| `zod` | high | Yes |

These advisories remain a maintenance item. This documentation/publication task did not perform dependency upgrades or validate a production security posture.
