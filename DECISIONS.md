# CollabCode decisions

## One monorepo contract

The two source briefs used different folder structures and AI providers. The
implementation uses pnpm workspaces and Turborepo with five packages:
`shared`, `server`, `dashboard`, `extension`, and `sim`. All socket event names
and payloads live in `@collabcode/shared`.

## Local-first operation

The complete demo works without cloud accounts. Classroom state and replay
events are held in memory, which keeps setup immediate and makes the simulator
deterministic. The store is deliberately isolated behind `ClassroomStore`, so
a PostgreSQL adapter can replace it without changing socket clients.

## AI fallback

Gemini is optional. When `GEMINI_API_KEY` is absent or the provider is
unavailable, the server generates a deterministic Socratic hint from code,
errors, and idle state. Hints are cached for one minute in both modes.

## Privacy boundary

The extension sends the active file content only while a student has explicitly
joined a room. Leaving the room stops capture. Help alerts are anonymous in the
instructor alert banner, while the underlying student state remains available
for an instructor who opens the classroom grid.

## Integrity signals

Academic-integrity output is a review aid, not an accusation. It combines code
token overlap and edit timing and intentionally labels the result for instructor
review.

## Authentication

The local build does not require Supabase. Production authentication is left as
an infrastructure boundary rather than simulated security. Deployments should
place the server behind institutional SSO or add verified JWT middleware before
exposing instructor routes publicly.
