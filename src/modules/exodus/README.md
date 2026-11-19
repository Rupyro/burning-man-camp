# `exodus`: Departure schedule and sweep crew

Plan Phase 8. On for every camp.

| | |
|---|---|
| Route | `/exodus` |
| Access | everyone (confirmed members); admins always |
| Capabilities | `exodus.view` (members: see the plan, set their own departure), `exodus.manage` (camp lead, LNT lead, admin: travel notes and the sweep-crew gap) |
| Tables | `exodus_departures` (one per person per edition) |
| Migrations | `migrations/`, table `__drizzle_migrations_exodus` |
| Events / jobs | none |
| Rules | sweep crew wanted = one in ten of the camp, at least two |
| Sensitive data | travel notes (free text), shown to managers only |
