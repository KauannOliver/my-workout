# My Workout

An offline-capable training planner with resumable workout sessions.

**Next.js, React, TypeScript, Tailwind CSS, Dexie, IndexedDB, Zustand, Serwist**

## What it does

- Creates workout plans and sessions with timers and resume support.
- Keeps exercise history, progress and local IndexedDB records.
- Provides local backups and an offline-capable PWA; optional web push has separate configuration.

## Workflow

```mermaid
flowchart LR
  N0["Plan"] --> N1
  N1["Start or resume session"] --> N2
  N2["Sets and timers"] --> N3
  N3["IndexedDB persistence"] --> N4
  N4["History and backup"]
```

## Local setup and use

```powershell
npm ci
npm run dev
```
Use a maintained Node.js LTS release. `npm run build` produces the local production build; it does not publish it.
Use `npm run typecheck`, `npm run lint`, `npm test` and `npm run build` for the included checks. Optional push requires the VAPID and Redis settings from `.env.example`.

## Configuration

Environment names declared by the included examples (values must be supplied locally):

`APP_PORT`, `CRON_SECRET`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `UPSTASH_REDIS_REST_TOKEN`, `UPSTASH_REDIS_REST_URL`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.

## Boundaries and limitations

The author confirms an AI/GPT-OSS feature in the broader project, but its implementation was not located in this snapshot. It is not presented as a runnable feature here. Offline behavior depends on a completed initial load and browser support; device-local data requires backups.

This is a source snapshot, not a claim of production readiness. Business results, dates and unmeasured performance are intentionally not asserted. Application UI language is preserved.

## License

Original application code is available under the [MIT license](LICENSE). Third-party libraries, models, fonts and bundled assets retain their own licenses.

## Verification record

See [snapshot checks and remaining limitations](docs/VERIFICATION.md).
