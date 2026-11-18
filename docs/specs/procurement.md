# Spec: Procurement + inventory module (catalogue, stock, needs, suppliers)

**Status:** built with the defaults below, for Ruchir's review (17 Oct 2026, ET). **Plan:** `PLAN.md` "Module: Procurement +
inventory" (was S6), §4.7. **Tables:** `DATA_MODEL.md` §5. **Rulebook:** `MODULE_RULEBOOK.md`
(events §"Talking to other modules"). Demo data only.

## 1. What it is (and isn't)
A camp-wide **catalogue** of things we own or use (tools, kitchen gear, building materials,
food). **Stock** says how many of each sit where (Container A, Cape Town storage, an on-site
area) and in what condition. Teams raise **needs** ("4 staple guns for Gift projects by 1 Apr").
The **"do we already have it?"** check compares the need with usable stock and suggests what to
buy or borrow. A gap can be **turned into a spend request**: procurement emits an event and
Finance makes a draft request; Finance's decision comes back the same way. Members can update
stock counts from a phone on site. Leads get a needs board and a printable shopping list per team.

**Not:** purchase orders or supplier invoicing, barcode scanning, offline writes (V1), photo
uploads (no file storage yet), stock valuation, kitchen recipe roll-ups (the kitchen module and its
`kitchen.shopping_list.published` contract don't exist yet; the handler comes with kitchen).

## 2. Data (`procurement_` tables, FKs to base tables only)
- `procurement_items` (persistent across years): name, category text checked by the app (built-in: tool, kitchen_equipment,
  building_material, electrical, plumbing, safety, decor, consumable, food, camping,
  sound_lighting, other; plus camp-own keys from camp.config.ts since PR 11), unit (pcs, kg, L, m), is_asset, owner_label (oeaasies, khoena, shared,
  borrowed, rented), is_bottleneck (flag for scarce tools), notes. Unique lower(name).
- `procurement_locations`: name, kind (container, storage, site_area, person), description.
- `procurement_stock`: item, location, quantity numeric(10,2) ≥ 0, condition (good,
  needs_repair, broken, missing), counted_at, counted_by. Unique (item, location, condition).
- `procurement_stock_movements` (append-only): item, from/to location, qty, reason (count,
  purchase, load, consumed, broken, returned), actor, at, note. Every stock change writes one.
- `procurement_suppliers`: name, category, contact_name, contact_phone (leads only), email,
  website, notes, last_used_year.
- `procurement_needs`: edition, team, item, quantity_needed, quantity_on_hand_snapshot, status
  (needed, have_it, to_buy, to_borrow, purchase_requested, ordered, received, cancelled),
  is_critical, source (manual, template), supplier, needed_by, owner, spend_request_ref_id (soft
  ref to finance), estimate_cents (optional, for the spend request), notes.

## 3. Rules (pure, `rules/`, 90% coverage gate)
- **Have-it check:** usable = good stock across all locations; needs_repair, broken and missing
  are shown but not counted. Gap = max(0, needed − usable). Suggestion: gap 0 → "have it";
  otherwise "buy N" (or "borrow N" for items flagged borrowed/rented). The plan's example: need 4,
  own 2 in Container A (1 broken) → usable 1 → buy 3.
- **Need status machine:** needed → have_it | to_buy | to_borrow | cancelled; to_buy →
  purchase_requested (event) → to_buy on approval / needed on rejection → ordered → received.
  received is final; cancelled is final.
- **CSV import** (catalogue + stock): `name,category,unit,quantity,location,condition`; unknown
  category → other; bad rows are reported, not guessed.
- **Shopping list:** a team's needs in to_buy / purchase_requested / ordered, grouped by category.

## 4. Capabilities
| Capability | Who | Notes |
|---|---|---|
| `procurement.view` | confirmed members, admins | Catalogue, stock and needs (no supplier phones) |
| `procurement.stock.count` | confirmed members | Update a count on site; writes a movement with the actor |
| `procurement.need.raise` | members of the team `{teamId}` | Raise a need for their team |
| `procurement.need.manage` | leads of the team `{teamId}`, camp leads | Status changes, critical flag, convert to spend request |
| `procurement.catalogue.manage` | any team lead, camp leads, admins | Items, locations, suppliers, CSV import |
| `procurement.supplier.contact` | any team lead, camp leads | See supplier phone numbers |

## 5. Screens
- **Members (phone-first) `/procurement`:** search the catalogue; tap an item to see stock by
  place and condition and **update a count**; "my team's needs" cards with the have-it result;
  raise a need.
- **Leads (laptop-first) `/procurement`:** a needs board (columns by status, critical first), the
  have-it check inline, "turn the gap into a spend request" (or "mark purchase requested" when
  Finance is off), catalogue table, CSV import, and **Shopping list** per team (`/procurement/list/<team>`,
  print-friendly).
- **Item `/procurement/i/<id>`**, **Need `/procurement/n/<id>`** with history.

## 6. Shared task engine, audit and events
- A need converted to a purchase gets a `procurement.buy` task for its owner on the team's
  "Kit and buying <year>" project; closed when received or cancelled.
- Audit on every write (before/after).
- **Emits** `procurement.need.marked_critical` {needId, itemName, quantity, teamId, neededBy} and
  `procurement.need.purchase_requested` {needId, teamId, itemName, quantity, estimateCents?,
  requesterPersonId, neededBy}.
- **Handles** `finance.spend.decided`: approved → need goes to_buy with the spend request ref;
  rejected → back to needed. Duplicate deliveries are no-ops.
- **Finance handles** `procurement.need.purchase_requested` (added to the finance module in this
  stack): creates a **draft** spend request for the requester with a soft ref back to the need, so
  the requester can check the amount and send it. Its later decision already emits
  `finance.spend.decided`, which now carries the need ref.

## 7. Seed (fake, idempotent)
~30 fake catalogue items across categories (incl. staple guns: 2 in Container A, 1 of them broken),
6 locations, 4 fake suppliers (example.test emails, 555 phone numbers), and ~8 needs in every
status, including a critical generator need (feeds Logistics) and one purchase-requested need.

## 8. Base changes this module needs
None expected. Finance gets a new event handler and an optional `needRefId` on its event payload
(versioned contract, v stays 1 with an optional field).

## 9. Out of scope (V1)
Offline counts, barcodes, photos, valuations, purchase orders, kitchen roll-ups (with kitchen).

## 10. Decisions for Ruchir (defaults in brackets)
- **P1** Who manages the catalogue, locations and suppliers? [any team lead, camp leads, admins].
- **P2** Can any confirmed member update stock counts? [yes; every change is logged with who/when].
- **P3** Supplier phone numbers [leads and camp leads only; members see the supplier name].
- **P4** What counts as "have it"? [good only; needs-repair shown but not counted].
- **P5** Who can turn a gap into a spend request? [the team's leads and camp leads; the spend
  request is drafted for the person who converted it].
- **P6** Who flags a need critical? [team leads and camp leads].
- **P7** The 2026 tool list import [CSV upload by leads; the demo uses a fake list only].
- **P8** Stock is camp-wide, needs are per team and per edition [yes].

## 11. Open questions for Ruchir (one line each; the defaults above stand until answered)
- **Q1** Is there a 2026 kit/tool list (sheet or Notion page) to import, and who keeps it? (P7)
- **Q2** Which storage places are real: Container A, Cape Town storage (whose place?), anything else?
- **Q3** Should any member update stock counts, or only leads? (P2: any confirmed member, logged)
- **Q4** Which suppliers do we actually use, and who owns each contact? (demo suppliers are fake)
- **Q5** Food and kitchen stock: track here now, or wait for the Kitchen module? [wait for Kitchen]
