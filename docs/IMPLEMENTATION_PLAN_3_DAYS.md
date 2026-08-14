# WinGroX AI - 3-Day Delivery Plan (Supabase)

## Goal
Ship a live, low-cost, secure MVP+ system that covers end-to-end user flow from login to role-based workflow and document handling.

## Selected Stack (Final)
- Frontend + backend runtime: Next.js 16 (App Router, server actions)
- Auth + DB + Storage: Supabase
- Hosting: Vercel
- Data store: Supabase Postgres
- File store: Supabase Storage bucket `wingrox-docs`

## Cost Strategy
- Vercel free or lowest paid tier initially
- Supabase free or lowest paid tier initially
- Single monolith app (no separate API infra)
- Reuse one DB + one storage bucket + RLS (no extra services)

## Day 1 (Completed in code)
- Next.js production scaffold
- Supabase client/server/middleware integration
- Login/sign-up/sign-out server actions
- Role profile bootstrap table usage (`profiles`)
- Stage model constants (7 workflow stages)
- Participant profile persistence (Stage 1)
- Consent persistence (required + optional)
- Document upload metadata + privacy update flow
- Initial SQL schema with RLS and audit logs
- Build and lint clean

## Day 2 (Mostly completed in code)
- Architect workspace:
  - Completed: participant listing, claim flow, assignment by email and UUID
  - Completed: stage release controls (unlock/release/complete toggles)
  - Completed: action queue prioritization panel
- Coach workspace:
  - Completed: assigned-participant view foundation
  - Completed: permissioned document visibility (`coach` and `summary` only)
  - Completed: coach-specific action cards and summary prompts
- Sponsor workspace:
  - Completed: summary-only document visibility
  - Completed: sponsor dashboard metrics and status widgets
- Stage progress automation:
  - Completed: auto stage row initialization
  - Completed: unlock synchronization based on prior stage completion/release
  - Completed: gate transitions persisted in `stage_progress`

## Day 3 (In progress)
- Final workflow completion:
  - Completed: Stage 2 to Stage 7 note persistence and participant completion controls
  - Completed: notification feed and read-state action
  - Completed: role-focused coach/sponsor summary cards and architect action queue
  - Completed: stage collaboration polish with architect guidance notes and participant visibility
- Hardening and release:
  - Completed: privacy-aware RLS logic for role-scoped document reads
  - Completed: secure server-side document download endpoint with permission checks
  - Completed: Supabase Storage RLS policies for upload/read/update/delete in document bucket
  - Completed: `/api/health` endpoint and smoke checklist document
  - Pending: deploy to Vercel + Supabase prod project using real credentials
  - Pending: execute full smoke checks on live environment

## Definition of Done
- Users can sign up/sign in/sign out
- Roles are enforced by RLS + app logic
- Participant can save full profile and consents
- Participant can upload docs with privacy level
- Architect can drive stage releases
- Coach/sponsor only see approved scope
- App is deployed and accessible publicly
- Core flows pass smoke tests

## Remaining External Dependencies
- Add real Supabase credentials and storage bucket policy in target environment.
- Execute final live smoke checks on deployed URL.

## Risks and Mitigations
- Risk: late RLS policy gaps
  - Mitigation: test role-by-role with isolated accounts before go-live
- Risk: file upload permission mismatch
  - Mitigation: lock naming convention per participant folder and verify bucket policies early
- Risk: last-minute UI parity details
  - Mitigation: preserve prototype at `/prototype/index.html` and port screen-by-screen
