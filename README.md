# ThueRadar

ThueRadar is a legal-tax research and AI support platform for Vietnamese tax law. This repository currently contains a working prototype foundation with responsive document-search and AI-support interfaces, plus explicit configuration status warnings.

## Current Status
- Demo UI is implemented and running in a Next.js app
- Search/filter UI reads verified records from the database and shows an explicit empty state when no records are available
- Phase 3 document APIs support search, filters, pagination, detail pages, version history, and authenticated save/unsave actions
- Phase 4 source-ingestion foundation includes a reviewed GDT adapter, guarded dry-run crawler, rate limits, retries, checksums, deduplication, and ingestion logs
- Phase 5 RAG foundation retrieves verified database documents, validates citations, and keeps AI provider calls on the backend
- Phase 6 has an independent timezone-aware sync worker, PostgreSQL lock, retry/history records, and an ADMIN-only manual trigger
- Missing production setup for database, auth, AI, and scheduler
- Prisma schema changes for Phase 3 are prepared but must be migrated only against an explicitly configured development/staging database
- Legal-source and evidence rules are documented and enforced as design constraints
- No legal source data has been claimed as collected; run the explicit dry-run only after reviewing [docs/LEGAL_SOURCE_ACCESS.md](./docs/LEGAL_SOURCE_ACCESS.md)
- AI answers are not simulated: without database evidence or a provider key, the API returns an explicit unconfigured/no-evidence status
- Scheduler operation is not claimed until a deployment platform runs `npm run sync:worker` and its `SchedulerRun` result is verified
- Phase 7 adds database-backed saved-document listing, topic follows, notifications, AI answer feedback/reporting, document moderation, and audit events
- Phase 7 database changes are schema-ready only; no migration or production workflow is claimed until a safe `DATABASE_URL` is configured
- Phase 8 validation passes for build, lint, typecheck, RAG guards, configuration-boundary API tests, and one Playwright browser flow; real database integration, live crawler, AI provider, scheduler execution, and dependency remediation remain pending
- Remaining work is tracked step-by-step in [docs/PHASE_8_REMEDIATION.md](./docs/PHASE_8_REMEDIATION.md); the project remains `NEEDS_SIGNOFF` until the staging and production verification gates there pass

## Local Development
```bash
npm install
npm run dev
```

## Environment
Copy `.env.example` to `.env.local` and fill in real values for any real deployment.

## Project Documents
- [docs/PROJECT_AUDIT.md](./docs/PROJECT_AUDIT.md)
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
- [docs/IMPLEMENTATION_PLAN.md](./docs/IMPLEMENTATION_PLAN.md)
- [docs/DATA_SOURCES.md](./docs/DATA_SOURCES.md)
- [docs/LEGAL_ACCURACY.md](./docs/LEGAL_ACCURACY.md)

## Important Safety Note
This is not yet a production legal advisory system. All AI and document functionality is intentionally presented as demo or configuration-required until verified production infrastructure is in place.
