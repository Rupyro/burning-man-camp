# `schedule`: Camp schedule (Workshops and Offerings pack)

Plan Phase 7. On by default only when the camp's packs include `workshops`.

| | |
|---|---|
| Route | `/schedule` |
| Access | everyone (confirmed members); admins always |
| Capabilities | `schedule.view` (members), `schedule.manage` (camp lead, admin: add, remove, export; the pack's schedule lead once its role key is in base) |
| Tables | `schedule_events`; enum `schedule_category` |
| Migrations | `migrations/`, table `__drizzle_migrations_schedule` |
| Events / jobs | none |
| Export | CSV for the official event guide (check the guide's current columns before uploading) |
| Sensitive data | none |
