# `sound`: Sound plan and neighbor log

Plan Phase 6 (Sound pack). On by default only when the camp's packs include `sound`.

| | |
|---|---|
| Route | `/sound` |
| Access | everyone (confirmed members); admins always |
| Capabilities | `sound.view` (members: read, log a neighbor's visit), `sound.manage` (sound officer, camp lead, admin: change the plan) |
| Tables | `sound_plans` (one per edition), `sound_neighbor_log` |
| Migrations | `migrations/`, table `__drizzle_migrations_sound` |
| Events / jobs | none |
| Sensitive data | none: neighbor names are camp names or first names typed by members |
