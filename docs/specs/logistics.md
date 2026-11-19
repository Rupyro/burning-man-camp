# Spec: Logistics module (loads, critical kit, members' travel, rides, exports)

**Status:** built with the defaults below, for Ruchir's review (17 Oct 2026, ET). **Plan:** `PLAN.md`
"Module: Logistics" (was S7), §4.7. **Tables:** `DATA_MODEL.md` §6. **Rulebook:** `MODULE_RULEBOOK.md`
(events §7). Demo data only. **Waiting on:** the logistics leads for the travel form fields (placeholders below).

## 1. What it is (and isn't)
Two halves on one screen:
- **Kit on the move (leads).** Places (Cape Town storage, the container yard, site), vehicles with a
  rough driver and seats, and **loads**: outbound, return or on-site batches with an origin, a
  destination, a departure and a status (planned → packing → in transit → delivered). Load items say
  what goes on which load. A **critical** item with no load (or on a load with no destination) is a
  **gap**: it shows at the top of the logistics board and in the logistics team's "my stuff" strip.
  Procurement's `procurement.need.marked_critical` event adds an unassigned critical load item, so a
  critical generator can't be forgotten. Confirming delivery stamps who and when.
- **Getting people there (members).** Each member says how they travel **to** and **from** the burn:
  offering a ride (seats, area, date), needing a ride, or sorting it themselves. A simple **ride board**
  shows offers that match your direction, dates (± 1 day) and area. You ask for a seat; the driver
  accepts or declines. **Phone numbers show only to the two people in an accepted match.**
- **Exports (leads).** Arrival manifest per day (from the base member record's arrival dates) and
  the **builders' WAP list: name and email only** (members give ID details to Quicket themselves).

**Not:** ticketing or WAP submission (Quicket), GPS/live tracking, route planning, fuel costs (Money
module), vehicle registration (Obligations), offline writes (V1), ID or passport numbers (never).

## 2. Data (`logistics_` tables, FKs to base tables only)
- `logistics_places` (camp-wide): name, kind (storage, container_yard, site, pickup, airport,
  city_area, supplier), address_text, notes. Unique lower(name).
- `logistics_vehicles` (per edition): label, kind (car, truck, trailer, container_truck,
  mutant_vehicle), driver_person_id, seats, cargo_notes.
- `logistics_loads` (per edition): name, direction (outbound, return, internal), vehicle,
  origin, destination (nullable: a load without one is a gap for its critical items), departs_at,
  status (planned, packing, in_transit, delivered, cancelled), delivered_confirmed_at/by, notes.
- `logistics_load_items` (per edition): load (null = needs a load), source ref (`procurement.need`
  or `procurement.item`, no FK), description (copied in so it reads without procurement), quantity,
  unit, is_critical, needed_by, packed_at/by, source_event_id (unique: duplicate events write
  nothing).
- `logistics_travel_plans` (per edition and person): direction (to_burn, from_burn), mode
  (offering_ride, need_ride, own_arrangement), area place + detail, travel date and time of day
  (morning, afternoon, evening, flexible), seats_offered / seats_needed, carries_cargo, notes.
  Unique (edition, person, direction).
- `logistics_ride_matches`: driver plan, passenger plan, seats, status (proposed, accepted,
  declined, cancelled), asked_at, decided_at. Unique (driver plan, passenger plan).

## 3. Rules (pure, `rules/`, 90% coverage gate)
- **Load status machine:** planned → packing → in_transit → delivered; any open status → cancelled;
  packing → planned and in_transit → packing allowed (undo). delivered and cancelled are final.
  Delivering stamps who and when.
- **Gaps:** a critical item is a gap if it has no load, its load is cancelled, or its load has no
  destination. Sorted by needed-by date.
- **Ride matching:** same direction; the offer has seats left (seats − accepted passengers' seats ≥
  seats needed); travel dates within 1 day; same area, or either side has no area. Closest date first.
- **Phone visibility:** only the driver and passenger of an **accepted** match see each other's phone.
- **WAP list:** confirmed members with a partial or full build commitment, sorted by name, columns
  `name,email` only. **Arrival manifest:** confirmed members grouped by arrival day in camp time.

## 4. Capabilities
| Capability | Who | Notes |
|---|---|---|
| `logistics.view` | confirmed members, admins | Your travel, the ride board, loads (read-only) |
| `logistics.travel.edit` | confirmed members (own plans only) | |
| `logistics.ride.ask` | confirmed members | Ask a driver for a seat; the driver accepts or declines |
| `logistics.loads.manage` | Logistics team (leads and members), camp leads | Places, vehicles, loads, items, assign gaps |
| `logistics.delivery.confirm` | Logistics team, any team lead, camp leads | Stamps who and when |
| `logistics.export` | Logistics team leads, camp leads, admins | Arrival manifest and WAP list (CSV) |

## 5. Screens
- **Members (phone-first) `/logistics`:** "Your travel" (to and from the burn) with an edit form,
  your ride matches (phone shown once accepted), seat requests waiting for you as a driver, and
  matching offers with "Ask for a seat".
- **Leads (laptop-first) `/logistics`:** counters (loads, critical gaps, arriving this week, need a
  ride), the **gaps** panel with "put it on a load", the loads table, a new-load form, arrivals by day,
  and the two CSV exports.
- **Load `/logistics/l/<id>`:** items (critical first), add an item, move status, confirm delivery.

## 6. Shared task engine, audit and events
- Audit on every write (before/after).
- **Handles** `procurement.need.marked_critical`: adds an unassigned critical load item with a soft
  ref to the need (the item name, with its quantity and unit, shown as "Generator 5 kVA × 2"); idempotent on the event id.
- "My stuff" (`myItems`): Logistics team and camp leads see one "alert" per critical gap; members
  see seat requests waiting for them and accepted rides.
- No tasks in V1 (a load's packing task can come later); no events emitted.

## 7. Seed (fake, idempotent)
Places (Cape Town storage, container yard, Tankwa site, airport, CBD, southern suburbs), 4 fake
vehicles, 5 loads (Container Day ×2, perishables run, art car, return), items incl. an **unassigned
critical generator** (the plan's demo gap), ~20 travel plans across both directions with offers
and needs, one accepted ride and one waiting request.

## 8. Base changes this module needs
None. It reads the base member record (arrival, build commitment, email, phone) read-only through
`@/base/api/schema`; phones only for accepted matches.

## 9. Out of scope (V1)
Live tracking, route planning, fuel costs, vehicle paperwork, shuttles with timetables, offline.

## 10. Decisions for Ruchir (defaults in brackets)
- **L1** Who manages loads, places and vehicles? [the Logistics team (leads and members) and camp leads].
- **L2** Who can confirm a delivery? [Logistics team, any team lead, camp leads].
- **L3** Ride phone numbers [shown only to the two people in an accepted match; the base profile
  phone is used].
- **L4** Ride matching [same direction, dates within 1 day, same area or no area given].
- **L5** WAP list [confirmed members with a partial or full build commitment; name and email only].
- **L6** Travel form fields [direction, mode, area, date, time of day, seats, carrying cargo, notes]
  until the logistics leads confirm theirs.
- **L7** Who downloads the exports? [Logistics team leads, camp leads, admins].
- **L8** A critical item counts as a gap until it's on a load with a destination [yes].

## 11. Open questions for Ruchir (one line each; the defaults above stand until answered)
- **Q1** Who is on the Logistics team for 2027, and who leads it? (L1, L2, L7 hang off that team)
- **Q2** What travel questions do the logistics leads already ask members? (L6 fields are placeholders)
- **Q3** Who counts as a builder for the WAP list: full build only, or partial too? (L5: both)
- **Q4** Does the camp lead submit WAP names, or does each builder request their own on Quicket?
- **Q5** Which pickup areas should the ride board offer (CBD, southern suburbs, airport, Stellenbosch…)? (L4)
- **Q6** What are the real vehicles and the Container Day date for 2027? (demo ones are fake)
- **Q7** Should members see the loads table read-only, or only their own travel and rides? [read-only]
