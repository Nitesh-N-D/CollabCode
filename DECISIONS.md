# Architecture decisions

- Supabase is the required source of truth for sessions, students, telemetry,
  hints, replay, and instructor identity.
- In-memory state is only a live Socket.IO cache. It cannot create rooms or
  authorize instructors.
- Room codes are generated server-side and are globally unique in PostgreSQL.
- Instructors can own many rooms and can participate in rooms shared with them.
- Only room owners may invite co-instructors or end a session.
- Students do not require accounts; an active room code and a locally persisted
  student key identify their connection.
- The simulator remains available only as an explicit test/load tool.
