# ThueRadar

ThueRadar is a legal-tax research and AI support platform for Vietnamese tax law. This repository currently contains a working prototype foundation with responsive document-search and AI-support interfaces, plus explicit configuration status warnings.

## Current Status
- Next.js UI is implemented with document search, AI support, login/account state, and an admin dashboard.
- Supabase staging database is connected and the Prisma migrations are applied.
- Staging has been live-tested with official GDT crawler data: 17 documents, 16 document versions, and 1 source.
- A live sync run created a `SchedulerRun` with `status = COMPLETED`.
- Windows Task Scheduler has been created to run the sync worker daily at 02:00.
- Verified documents are published through reviewer/admin moderation and are the only records eligible for RAG.
- AI answers use Azure OpenAI server-side and include source citations and UNKNOWN-validity warnings.
- GitHub-hosted Actions are not used as the primary crawler scheduler because their outbound network timed out against GDT.
- Dependency audit, production database separation, full authenticated E2E, mobile/tablet visual sign-off, monitoring/alerting, and production sign-off remain pending.

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
