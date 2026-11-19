# `mv`: Art car drivers (Mutant vehicle pack)

Plan Phase 7. On by default only when the camp's packs include `mutant-vehicle`.

| | |
|---|---|
| Route | `/mv` |
| Access | everyone (confirmed members); admins always |
| Capabilities | `mv.view` (members: see the roster, offer to drive), `mv.manage` (DMV contact, camp lead, admin: clear drivers, audited) |
| Tables | `mv_drivers` (one per person per edition) |
| Migrations | `migrations/`, table `__drizzle_migrations_mv` |
| Events / jobs | none |
| Sensitive data | none (no license numbers are stored, only "cleared") |
