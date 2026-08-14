# Smoke Test Checklist (Pre-Go-Live)

## 1. Auth
- Sign up as participant, architect, coach, sponsor
- Sign in and sign out for each role
- Verify unauthenticated access to `/app` redirects to `/login`

## 2. Participant flow
- Save profile fields (Stage 1)
- Toggle required consents
- Upload a document and update privacy
- Download own document from workspace table
- Add notes for stages 2 to 7
- Mark stages complete and incomplete

## 3. Architect flow
- Open participant list
- Claim a participant
- Assign coach or sponsor by email
- Toggle stage unlock/release/complete
- Save architect guidance note for a stage and verify participant can view it
- Verify notifications are visible

## 4. Coach flow
- Verify only coach-allowed docs are visible (`coach`, `summary`)
- Verify stage notes show only released content

## 5. Sponsor flow
- Verify only summary docs are visible (`summary`)
- Verify restricted stage visibility behavior

## 6. Security checks
- Confirm document privacy restrictions are enforced by RLS, not only UI
- Confirm unauthorized users cannot download document URLs by direct endpoint call
- Confirm users cannot update unrelated participant records
- Confirm notifications can only be marked read by target user or admin

## 7. Deployment checks
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- GET `/api/health` returns status ok
