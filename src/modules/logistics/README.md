# `logistics`: travel, rides, loads and critical kit

Spec: `docs/specs/logistics.md`.

| | |
|---|---|
| Route | `/logistics` (members: your travel and the ride board on a phone; leads: gaps, loads, arrivals, exports), `/logistics/l/<load>` |
| Tile | "Travel and loads", order 130 |
| Access | everyone (confirmed members); admins always |
| Capabilities | `logistics.view`, `logistics.travel.edit`, `logistics.ride.ask`, `logistics.loads.manage`, `logistics.delivery.confirm`, `logistics.export` |
| Tables | `logistics_places`, `_vehicles`, `_loads`, `_load_items`, `_travel_plans`, `_ride_matches` |
| Migrations | `migrations/`, table `__drizzle_migrations_logistics` |
| Events emitted | none |
| Events handled | `procurement.need.marked_critical` (adds an unassigned critical load item) |
| My stuff | Logistics team and camp leads: one alert per critical gap. Everyone: seat requests waiting for them as a driver, and agreed rides |
| Export | all logistics tables; plus the WAP list and arrivals CSVs on the home screen (logged) |
| Sensitive data | phone numbers are never stored here; they're read from the base profile and shown only inside an accepted ride match. No ID or passport numbers, ever. |

Open questions: see spec §10.
