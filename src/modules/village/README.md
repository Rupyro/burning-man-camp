# `village`: Shared resources (Village or HUB pack)

Plan Phase 7. On by default only when the camp's packs include `village`.

| | |
|---|---|
| Route | `/village` |
| Access | everyone (confirmed members); admins always |
| Capabilities | `village.view` (members), `village.manage` (team leads, camp lead, admin: record shares, mark returned; the pack's village liaison once its role key is in base) |
| Tables | `village_shares`; enums `village_direction`, `village_resource` |
| Migrations | `migrations/`, table `__drizzle_migrations_village` |
| Events / jobs | none |
| Sensitive data | none (partner camp names only) |
