# Architecture Overview

## Product Direction
ThueRadar should function as a research and assistance system for Vietnamese tax law, combining legal-document search, evidence-backed AI responses, and operational controls.

## Proposed Architecture
- Frontend: Next.js App Router + TypeScript + Tailwind
- State/UI layer: server and client components for search and document display
- API layer: route handlers for search, detail, AI chat, and admin functions
- Data layer: persistent relational database with document metadata, sources, and sync status
- AI layer: retrieval pipeline with legal-source grounding and citation validation
- Operations layer: scheduler, retry logic, status monitoring, and admin dashboards

## Design Principles
- Source-first: every answer should trace to verifiable legal sources
- No fabricated live integrations: show missing configuration clearly
- Evidence over speculation: AI output requires citation review
- Secure by default: RBAC, audit logs, and verification checks

## Known Gaps
This prototype does not yet implement the full architecture above.
