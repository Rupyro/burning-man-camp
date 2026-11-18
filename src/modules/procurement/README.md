# `procurement`: kit, stock and needs

Spec: `docs/specs/procurement.md`.

| | |
|---|---|
| Route | `/procurement` (members: search, team needs, scarce tools on a phone; leads: totals, needs board, catalogue table, CSV import), `/procurement/new`, `/procurement/i/<item>`, `/procurement/n/<need>`, `/procurement/list/<team>` (printable) |
| Tile | "Kit and stock", order 120 |
| Access | everyone (confirmed members); admins always |
| Capabilities | `procurement.view`, `procurement.stock.count`, `procurement.need.raise`, `procurement.need.manage`, `procurement.catalogue.manage`, `procurement.supplier.contact` |
| Tables | `procurement_items`, `_locations`, `_stock`, `_stock_movements`, `_suppliers`, `_needs` |
| Migrations | `migrations/`, table `__drizzle_migrations_procurement` |
| Task kinds | `procurement.buy` |
| Events emitted | `procurement.need.marked_critical`, `procurement.need.purchase_requested` |
| Events handled | `finance.spend.decided` |
| Export | all procurement tables; `procurement_suppliers.contact_phone` blanked by default |
| Sensitive data | supplier phone numbers (leads only) |
| Seed | 30 fake items, 6 places, 4 fake suppliers, 10 needs in every status |

Not in V1: the need page shows its current state, not a step-by-step history (the base audit log has it; modules can't read it yet). "Ask finance for the money" needs a rough amount; Finance then drafts a spend request for the lead who asked (if the team has a budget), and its decision moves the need. With Finance switched off (or no team budget), "Ask finance for the money" still moves the need to "Asked finance" and a lead handles it by hand (PLAN.md).

Open questions: see spec §10.
