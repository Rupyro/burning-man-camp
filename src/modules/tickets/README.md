# `tickets`: Tickets and passes

Plan Phase 3. Each member says where they are with their ticket, vehicle pass and early-arrival pass
(Setup Access Pass at Burning Man); camp leads see the camp board against what the event allocated.

| | |
|---|---|
| Route | `/tickets` (your status for everyone; the camp board for camp leads and admins) |
| Tile | none yet |
| Access | everyone (confirmed members); admins always |
| Capabilities | `tickets.view` (members: own status), `tickets.manage` (camp lead, admin: board and allocations) |
| Tables | `tickets_status` (one row per person per edition), `tickets_allocations` (one row per edition); enums `tickets_ticket_state`, `tickets_pass_state`, `tickets_early_state` |
| Migrations | `migrations/`, table `__drizzle_migrations_tickets` |
| Events | none |
| Jobs | none |
| Export | both tables (no sensitive columns; no ticket numbers or ID details are stored) |
| Sensitive data | none: states only, never ticket numbers, names on IDs or payment details |

Gate-ready = has a ticket, and has every pass they said they need (`rules/gate.ts`).
