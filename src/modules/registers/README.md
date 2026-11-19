# `registers`: Safety registers

Plan Phases 6 (fuel, flame effects) and 8 (stakes). On for every camp.

| | |
|---|---|
| Route | `/registers` |
| Access | everyone (confirmed members); admins always |
| Capabilities | `registers.view` (members), `registers.manage` (team leads, fire safety officer, LNT lead, safety officer, camp lead, admin: add, remove, count stakes pulled) |
| Tables | `registers_items`; enum `registers_kind` (fuel, flame, stake) |
| Migrations | `migrations/`, table `__drizzle_migrations_registers` |
| Events / jobs | none |
| Rules | stored fuel against the event pack's `fuel.storageLimit`; stakes left = in − pulled |
| Sensitive data | none |
