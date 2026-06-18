# CollabCode

Production-oriented real-time classroom coding intelligence.

## Architecture

- Instructor dashboard: React, Vite, Supabase Auth
- Student portal: public join-by-code React app
- Student editor: VS Code extension with live hint panel
- Backend: Express and Socket.IO
- Persistence: Supabase PostgreSQL
- AI hints: optional Gemini with a deterministic Socratic fallback

Many instructors can sign in and create multiple independent rooms at the same
time. Room ownership and co-instructor membership are enforced by authenticated
user IDs. Many students can join each room concurrently.

No production page is populated with fake students. The included simulator is
an explicit load/testing utility and can only join a real active room code.

See [RUNBOOK.md](RUNBOOK.md) for setup, verification, and deployment.
