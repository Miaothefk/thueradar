# Project Audit

## Overview
ThueRadar is a legal-tax research and AI support platform for Vietnamese tax law. The current repository is a working Next.js prototype that demonstrates the intended product structure and user flows, but it does not yet include production-grade data ingestion, authorization, or AI integration.

## Current Status
- Prototype status: Functional demo UI with document search/filter experience
- Data status: No legal records are rendered until a verified source and backend are configured
- AI status: Not connected to a production model or retrieval system
- Database status: Not configured; no migration or schema committed yet
- Scheduler status: Not implemented; no sync job or run history exists
- Auth status: Not implemented

## Risk Summary
The application explicitly avoids fake claims. It presents system state and missing configuration rather than pretending that legal databases, AI assistants, or automation services are live.

## Recommended Next Steps
1. Define the production data model.
2. Configure database and auth foundation.
3. Build legal-source ingestion and verification pipeline.
4. Add retrieval + citation-aware AI support.
5. Implement scheduler and monitoring.
6. Validate with lint/build/test checks.

## Acceptance Criteria for Mature Version
- Verified official legal document sources
- Persistent storage with audit trail
- Secure user access and role-based permissions
- Source sync pipeline with retry and error analysis
- AI responses with citations and evidence requirements
- Production configuration and deployment checks
