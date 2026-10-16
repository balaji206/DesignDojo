# REST API Reference — DesignDojo

All endpoints accept the `x-learner-id` header to scope attempts to the active learner.

- `GET /api/health` — Returns service health and `aiConfigured` boolean.
- `GET /api/problems` — Lists all seeded problems with learner attempt count, status, and best score.
- `GET /api/problems/:id` — Returns problem details and rubric by ID or slug (`404` if not found).
- `POST /api/attempts` — Validates, persists, and evaluates a new design submission (`201` on success, `400` on validation error).
- `GET /api/attempts/:id` — Returns a specific attempt snapshot and evaluation report (`404` if not found).
- `GET /api/problems/:id/attempts` — Lists all attempts by the learner for a given problem.
- `POST /api/attempts/:id/retry` — Creates a new immutable attempt (`N + 1`) cloned from an earlier attempt.