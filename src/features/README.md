# Feature modules

Feature-oriented layout. Each folder owns its own UI, server logic, and
validation for one product area. In the foundation phase only `auth` and the
workout `import` module carry real logic; the others are placeholders whose
real features arrive in later phases.

- `auth/` — registration, login, sessions, password hashing, data-ownership helpers. (built)
- `workouts/` — routine import module (JSON/CSV parser). (built: import only)
- `profile/` — user profile + fitness goals. (placeholder)
- `nutrition/` — nutrition plans, food logging, daily summaries. (placeholder)
- `dashboard/` — aggregated views and charts. (placeholder)
- `recommendations/` — AI training/nutrition recommendations. (placeholder)
