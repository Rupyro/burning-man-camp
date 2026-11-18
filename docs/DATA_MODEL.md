# Oe-aa-sies platform: data model (V1)

**Prepared:** Fri 9 Oct 2026 (ET). Companion to `PLAN.md` §4–5. Postgres 16+ via Drizzle ORM. Nothing here is implemented yet.

**Updated Sat 10 Oct 2026 (ET), prefixes only.** For the modular architecture (`MODULE_RULEBOOK.md` §5): base tables keep their names; each module's tables now carry its prefix; foreign keys that crossed from one module into another became **soft references** (an id plus a type, no FK); and the few module fields that sat on base tables moved into the module. Beyond what that requires (three small base tables for module flags and events, and task kinds that modules register), nothing else in the model changed. Summary of what moved is in §15.

**Updated Tue 13 Oct 2026 (ET), diet and allergies.** Following Ruchir's decision of 11 Oct (B1 spec §2, rule 2) and the B1 schema: diet and allergies are **normal camp data** on `edition_members`, not sensitive data in a kitchen table. Kitchen leads see them by name through the admin-granted `kitchen_sensitive_viewer` role (capability `member.view_dietary`). There is no consent flag, no purge date and no audit row per view. They are still never written to app logs, error messages, or audit `changes` values (recorded as `"[redacted]"`). Phone and emergency contacts stay sensitive (§13). The kitchen module's `kitchen_dietary_profiles` table is gone (§8, §15).

## 0. Conventions (apply to every table unless stated)

| Convention | Rule |
|---|---|
| Prefixes | **Base** tables (§1–3, §11 documents/guide/announcements, §12) have no prefix. **Module** tables, enums and views start with the module's prefix: `obligation_`, `finance_`, `procurement_`, `logistics_`, `shift_`, `kitchen_`, `programming_`, `export_`, `binder_` (`content` has no tables in V1). A module table's foreign keys point only to its own tables or to base tables. |
| Soft references | A link to another module's row is two columns, `<name>_ref_type varchar(40)` + `<name>_ref_id uuid`, with no FK (or just `<name>_ref_id` where the type is fixed). Type names live in `src/contracts/refs.ts`. Kept up to date by events. |
| Naming | SQL tables and columns `snake_case`, plural tables (`task_assignments`). Drizzle exports are camelCase of the table (`export const taskAssignments = pgTable("task_assignments", …)`). Enums: `pgEnum("task_status", […])`, exported as `taskStatusEnum`. |
| Single camp | No `camp_id`/tenant column anywhere. Camp-wide settings live in the singleton `camp_settings`. Year-scoped data carries `edition_id`. |
| Ids | `id uuid primary key`, UUIDv7 generated in the app (`src/lib/ids.ts`), so ids sort by time and can be created offline later. |
| Standard columns | `created_at timestamptz not null default now()`, `updated_at timestamptz not null default now()` (set by app), `deleted_at timestamptz null` (soft delete), `version integer not null default 1` (optimistic concurrency, future offline sync). Tables marked *append-only* omit `updated_at/deleted_at/version`. |
| People references | `*_person_id uuid references people(id) on delete restrict`. Auth users are separate (§1). |
| Money | `amount_cents bigint not null` + `currency char(3) not null default 'ZAR'`. Optional `fx_rate_to_zar numeric(12,6)` where a foreign amount must roll up. Never floats. |
| Time | All instants `timestamptz` (stored UTC). Display in camp time `Africa/Johannesburg` (setting); members can see their own zone. Calendar days (menu day, shift day) use `date`. |
| Deletes | `on delete restrict` for anything financial or audited. `cascade` only for pure children (checklist items, links). App code soft-deletes. |
| Partial indexes | Most uniques are `where deleted_at is null`. |
| Audit | Every mutation in §6, §7 and on roles/permissions writes an `audit_events` row in the same transaction (§12). |

Legend in tables below: **PK** primary key, **FK** foreign key, **U** unique, **IX** index, **?** nullable.

---

## 1. Camp, editions, people, auth

### `camp_settings` (singleton)
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | single row, enforced by `check (singleton = true)` + U on `singleton boolean default true` |
| name | text | "Oe-aa-sieS" |
| ref_prefix | varchar(6) | "OEA", used for spend refs (`OEA-SR-017`) |
| timezone | text | `Africa/Johannesburg` |
| default_currency | char(3) | `ZAR` |
| current_edition_id | uuid? FK editions | |
| digest_hour_local | smallint | default 7 |

### `editions`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| year | smallint U | 2027 |
| title | text | "AfrikaBurn 2027" |
| status | enum `edition_status` (`planning`,`active`,`closed`,`archived`) | |
| member_capacity | smallint? | 70 |
| cloned_from_edition_id | uuid? FK editions | year rollover |

### `anchor_dates`
Named dates templates schedule against.
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| edition_id | uuid FK editions | |
| key | varchar(40) | `container_day`, `build_start`, `gate_open`, `event_start`, `event_end`, `strike_start`, `strike_end`, `registration_deadline`, `final_payment`, … |
| label | text | |
| starts_at | timestamptz | |
| ends_at | timestamptz? | |
| is_confirmed | boolean default false | false → UI shows "TBC" |
| source_note | text? | e.g. "camp draft (FLOW)", "2026 date" |
| **U** | (edition_id, key) | |

### `people`
Persistent across years. A person can exist without a login (imported, waitlist, external performer is separate, see §10).
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | text? FK auth `user.id` **U** | null until they accept an invite |
| legal_first_name, legal_last_name | text | |
| playa_name | text? | |
| display_name | text | computed preference; shown everywhere |
| email | citext **U** (where deleted_at is null) | one person = one record |
| phone_e164 | text? | sensitive (§13) |
| country_code | char(2)? | |
| pronouns | text? | |
| bio | text? | ≤ 60 words (app check) |
| photo_document_id | uuid? FK documents | |
| first_burn_year | smallint? | |
| emergency_contact_name, emergency_contact_phone | text? | sensitive; only for Binder rules |
| directory_visibility | enum `directory_visibility` (`hidden`,`members`,`members_with_contact`) | default `members` |
| **IX** | lower(playa_name), lower(display_name) | dedupe/search |

**No ID/passport column in V1** (see PLAN §2 #5).

### Auth tables (Better Auth, generated)
`user`, `session`, `account`, `verification` (Better Auth defaults, `text` ids). Plus plugin tables for magic link and passkeys. Kept in schema file `db/schema/auth.ts`. App code never reads `account` directly.

### `invites`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| person_id | uuid FK people | |
| edition_id | uuid FK editions | |
| token_hash | text U | sha-256 of the token; raw token only in the email |
| invited_by_person_id | uuid FK people | |
| expires_at | timestamptz | default +30 days |
| accepted_at | timestamptz? | |
| revoked_at | timestamptz? | |

### `edition_members` (a person's year)
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| edition_id | uuid FK | |
| person_id | uuid FK | |
| status | enum `member_status` (`prospect`,`waitlisted`,`confirmed`,`withdrawn`,`removed`) | confirmed = gets an invite |
| payment_status | enum `payment_status_import` (`unknown`,`deposit_paid`,`paid_in_full`,`waived`,`overdue`) | **read-only import** from Jaxon's sheet/Howler; app never collects money |
| payment_status_synced_at | timestamptz? | |
| is_alumni | boolean | |
| alumni_years | smallint | |
| arrival_at, departure_at | timestamptz? | |
| arrival_confirmed | boolean default false | |
| early_leave_reason | text? | "reason if leaving before strike" |
| build_commitment | enum `crew_commitment` (`none`,`partial`,`full`) | |
| strike_commitment | enum `crew_commitment` | |
| strike_completed | boolean? | recorded after strike |
| tent_choice | enum `tent_choice` (`camp_dome`,`large_bell`,`byo_tent`,`caravan_or_car`,`undecided`) | |
| tent_assignment | text? | e.g. "Lapa 4 / Zone B / Dome 12" (light allocation) |
| diet | enum `member_diet` (`omnivore`,`vegetarian`,`vegan`,`pescatarian`,`other`)? | normal camp data (B1): self-edited; read by name with `member.view_dietary` (self, `kitchen_sensitive_viewer`, admins); never logged |
| allergies | text? | same rules as `diet`; free text, ≤ 300 chars |
| guide_acknowledged_at | timestamptz? | camp guide/rules acknowledgement |
| import_source | text? | "jaxon-sheet-2026-12-03.csv" |
| **U** | (edition_id, person_id) | |
| **IX** | (edition_id, status), (edition_id, arrival_at) | |

### `member_admin_notes`
Admin-only; members can never read. Separate table so a query bug can't leak it.
| id uuid PK · edition_member_id FK · author_person_id FK · body text · created_at |

### `skills`, `person_skills`
- `skills`: id, key varchar U (`carpentry`, `electrical`, `tractor_driver`, `sound_engineering`, `lighting_dmx`, `photography`, `first_aid`, `cooking_large_batch`…), label, is_qualification boolean (needs lead verification).
- `person_skills`: person_id FK, skill_id FK, level smallint?, verified_by_person_id FK?, verified_at? · **PK/U** (person_id, skill_id).

### `availability_windows`
| id · edition_member_id FK · starts_at · ends_at · kind enum (`available`,`unavailable`) · note | IX (edition_member_id, starts_at) |
Used for "available work" filtering and shift eligibility in addition to arrival/departure.

---

## 2. Teams, roles, permissions

### `teams`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| edition_id | uuid FK | |
| key | varchar(40) | `camp_infra`, `gift_projects`, `logistics`, `finance`, `kitchen`, `programming`, `community`, `marketing`, `content`, `knowledge`, `duties`, `moop` |
| name | text | |
| description | text? | |
| parent_team_id | uuid? FK teams | e.g. Power under Camp Infrastructure |
| whatsapp_invite_url | text? | shown as content only (no integration) |
| **U** | (edition_id, key) | |

### `team_memberships`
| id · team_id FK · person_id FK · role enum `team_role` (`lead`,`co_lead`,`member`) · joined_at | **U** (team_id, person_id) · IX (person_id) |

### `roles` (catalogue)
| id · key varchar U · label · kind enum `role_kind` (`system`,`capability`,`officer`) · description |
Seed: `admin` (system), `camp_lead` (system), `member` (implicit), `finance_approver` (capability), `kitchen_sensitive_viewer` (capability, granted to kitchen leads), `lnt_lead`, `fire_safety_officer`, `sound_officer`, `safety_officer`, `mv_dmv_contact`, `information_officer` (officer: labels + obligations, no extra permissions), `pilot` (system: sees modules whose flag audience is `pilot`).

### `role_assignments`
| id · edition_id FK? (null = permanent, e.g. admin) · person_id FK · role_id FK · scope_team_id FK? · granted_by_person_id FK · starts_at? · ends_at? (access expiry after season) | U (edition_id, person_id, role_id, scope_team_id) where deleted_at is null |

Capabilities are **code**, not rows (`src/base/authz/`; module capabilities are declared in each module's `permissions.ts`): a pure function `can(actor, capability, resource)` derives from `role_assignments` + `team_memberships` + resource ownership. Rationale: a permission change goes through code review and tests rather than a settings screen.

---

## 3. Shared work engine

### `projects`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| edition_id | uuid FK | |
| team_id | uuid FK teams | owning team |
| parent_project_id | uuid? FK projects | workstreams (design/build/install/strike) |
| template_id | uuid? FK project_templates | |
| key | varchar(40)? | short code, e.g. `CLOUD` |
| name | text | |
| kind | enum `project_kind` (`general`,`build_area`,`gift_project`,`procurement`,`logistics`,`obligations`,`content`,`marketing`,`knowledge`,`kitchen`,`programming`,`must_fix`) | filters/views only |
| phase | enum `season_phase` (`planning`,`pre_build`,`build`,`event`,`strike`,`return`,`post`) | |
| lead_person_id | uuid? FK people | |
| status | enum `project_status` (`proposed`,`active`,`on_hold`,`done`,`cancelled`) | |
| starts_on, due_on | date? | |
| description | text? | |
| carry_forward | boolean default false | `must_fix` lists, blueprints |
| **IX** | (edition_id, team_id), (parent_project_id) | |

### `tasks`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| edition_id | uuid FK | denormalised for fast dashboards |
| project_id | uuid FK projects | |
| parent_task_id | uuid? FK tasks | sub-tasks (one level in UI) |
| kind | varchar(40) | base kinds `task`, `milestone`; module kinds registered in each manifest, namespaced: `obligations.obligation`, `finance.purchase`, `content.coverage_request`, `content.marketing_item`, `exports.knowledge_dump`. Checked against the registry on write (was enum `task_kind`). |
| source_ref_type, source_ref_id | varchar(40)?, uuid? | soft reference to the module row that created the task (e.g. `finance.spend_request`) |
| title | text | |
| description | text? | markdown |
| status | enum `task_status` (`todo`,`in_progress`,`blocked`,`done`,`cancelled`) | |
| blocked_reason | text? | required when status = blocked (check) |
| priority | enum `priority` (`must`,`should`,`could`) | |
| phase | season_phase? | |
| owner_person_id | uuid? FK people | exactly one accountable owner (null = unowned) |
| starts_at | timestamptz? | |
| due_at | timestamptz? | |
| completed_at | timestamptz? | |
| location | text? | "Container A", "Kitchen", "Cape Town" |
| claim_mode | enum `claim_mode` (`closed`,`open`,`open_with_approval`) | |
| claim_capacity | smallint? | helpers wanted |
| effort_hours | numeric(5,1)? | |
| template_task_id | uuid? FK task_templates | |
| recurrence_series_id | uuid? FK recurrence_series | |
| occurrence_on | date? | which occurrence of the series |
| is_critical | boolean default false | escalates faster; shows on readiness |
| search_vector | tsvector (generated from title + description) | |
| **IX** | (edition_id, status, due_at); (owner_person_id, status); (project_id); GIN(search_vector); partial `where owner_person_id is null and status in ('todo','in_progress')` | dashboard queries |
| **U** | (recurrence_series_id, occurrence_on) where not null | idempotent recurrence |

### `task_dependencies`
| id · task_id FK (the dependent) · depends_on_task_id FK · kind enum (`finish_to_start`) · lag_hours smallint default 0 | **U** (task_id, depends_on_task_id) · IX (depends_on_task_id) · check task_id <> depends_on_task_id. Cycle check in `src/base/engine/rules/dependencies.ts` inside the insert transaction (recursive CTE). |

### `task_assignments`
Owner lives on `tasks.owner_person_id`; this table holds helpers and claims.
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| task_id | uuid FK | |
| person_id | uuid FK | |
| source | enum `assignment_source` (`assigned`,`claimed`) | |
| status | enum `assignment_status` (`pending_approval`,`active`,`declined`,`withdrawn`,`completed`) | claims start `pending_approval` if `claim_mode = open_with_approval` |
| decided_by_person_id | uuid? FK | |
| decided_at | timestamptz? | |
| **U** | (task_id, person_id) where status in ('pending_approval','active') | |

### `task_checklist_items`
| id · task_id FK cascade · position smallint · label · done_at? · done_by_person_id? |

### `task_comments`
| id · task_id FK · author_person_id FK · body text · edited_at? | IX (task_id, created_at). `@mentions` parsed into notifications.

### `task_watchers`
| task_id FK · person_id FK | PK (task_id, person_id)

### `project_templates` / `task_templates` / `task_template_dependencies`
- `project_templates`: id, key U, name, kind project_kind, team_key varchar? (default owning team), description, is_active.
- `task_templates`: id, project_template_id FK, title, description, kind, priority, phase, **anchor_key** varchar (matches `anchor_dates.key`), **offset_days** smallint (−14 = two weeks before), duration_hours?, default_owner_role_key? (e.g. team lead), claim_mode, claim_capacity, required_skill_keys text[], checklist text[], **recurrence_rule** text? (RFC 5545 RRULE, e.g. `FREQ=DAILY;COUNT=7`), is_critical, position.
- `task_template_dependencies`: task_template_id FK, depends_on_task_template_id FK, PK both.
- Applying a template = `src/base/engine/apply-template.ts`: one transaction creating project, tasks, deps; records `template_task_id`; due dates computed from anchors; re-running is a no-op unless forced.

### `recurrence_series`
| id · edition_id · template_task_id? · project_id · rrule text · dtstart timestamptz · until? · generated_through date · paused boolean |
Nightly job materialises occurrences up to N days ahead (default 21), idempotent by the unique (series, occurrence_on).

---

## 4. Shifts

### `shift_types`
| id · edition_id · team_id FK · key · name · description · checklist text[] · default_duration_minutes · required_skill_ids uuid[] · counts_toward_quota boolean · is_compulsory boolean · color? |
Seed from 2025–26 duties: Early Birds 08:30–09:30, Breakfast Run 09:00–11:00, Afternoon Warriors 14:30–15:00, Dinner Delight Squad 15:00–17:00, MOOP, Art car crew (needs `tractor_driver` for driver seat), Lighting/VJ, Build block, Strike block, Welcome committee.

### `shift_templates`
| id · shift_type_id FK · days_of_week smallint[] or `date_range` · start_time time · end_time time · capacity_mode enum (`fixed`,`per_headcount`) · capacity_fixed smallint? · capacity_per_10_people numeric(4,1)? · min_capacity · max_capacity |
Generates slots for a date range; capacity from the on-site headcount that day (edition_members arrival/departure).

### `shift_slots`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| edition_id | uuid FK | |
| shift_type_id | uuid FK | |
| shift_template_id | uuid? FK | |
| starts_at, ends_at | timestamptz | |
| capacity | smallint | |
| lead_person_id | uuid? FK people | shift lead (not a role) |
| location | text? | |
| task_id | uuid? FK tasks | optional link (e.g. a build block for a project) |
| status | enum (`draft`,`published`,`cancelled`) | |
| **IX** | (edition_id, starts_at), (shift_type_id, starts_at) | |

### `shift_signups`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| shift_slot_id | uuid FK | |
| person_id | uuid FK | |
| source | enum (`self`,`assigned`,`swap`,`imported`) | |
| status | enum `shift_signup_status` (`active`,`cancelled`,`swapped_out`,`no_show`,`attended`) | |
| role_in_shift | enum (`member`,`driver`,`radio`) | |
| **U** | (shift_slot_id, person_id) where status = 'active' | |
| **IX** | (person_id, status) | |

### `shift_swap_requests`
| id · from_signup_id FK · to_person_id FK? (null = open offer) · status enum (`open`,`accepted`,`declined`,`cancelled`,`needs_lead_approval`) · decided_by_person_id? · decided_at? |
Swap completes only if the receiver meets the skill rules and has no conflict.

### `shift_rules` (per edition)
| id · edition_id U · quota_default smallint (4) · quota_builders smallint (3) · early_access_hours smallint (72) · early_access_group enum (`builders`) · signup_opens_at · signup_closes_at · lead_fill_from_days smallint (7) · gap_alert_days smallint[] ({14,7,2}) |


### `shift_member_quotas` (moved from `edition_members.shift_quota`)
| edition_member_id uuid PK FK edition_members · quota smallint · reason text? | Per-person override of `shift_rules` quotas.

---

## 5. Procurement, inventory, suppliers

### `procurement_items` (catalogue, persistent across years)
| id · name · category varchar(40), app-checked (plan PR 11; was enum `procurement_item_category`): built-in `tool`,`kitchen_equipment`,`building_material`,`electrical`,`plumbing`,`safety`,`decor`,`consumable`,`food`,`camping`,`sound_lighting`,`other`, plus a camp's own `custom.materialCategories` · unit varchar (pcs, kg, L, m) · is_asset boolean · owner_label enum (`oeaasies`,`khoena`,`shared`,`borrowed`,`rented`) · notes · photo_document_id? | IX lower(name), category |

### `procurement_locations`
| id · name ("Container A", "Container B", "Cape Town storage", "Tools container", "Kitchen", "On site: Power") · kind enum (`container`,`storage`,`site_area`,`person`) · description · keys_held_by_person_id? |

### `procurement_stock`
| id · item_id FK · location_id FK · quantity numeric(10,2) · condition enum (`good`,`needs_repair`,`broken`,`missing`) · counted_at · counted_by_person_id | U (item_id, location_id, condition) |
Every change also writes `procurement_stock_movements` (append-only: item, from_location?, to_location?, qty, reason enum (`count`,`purchase`,`load`,`consumed`,`broken`,`returned`), load_item_ref_id? (soft ref to `logistics.load_item`), actor, at) so counts are explainable.

### `procurement_suppliers`
| id · name · category · contact_name? · contact_phone? (sensitive-lite) · email? · website? · notes · rating smallint? · last_used_year? |

### `procurement_needs`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| edition_id | uuid FK | |
| team_id | uuid FK | |
| project_id / task_id | uuid? FK | where it's needed |
| item_id | uuid FK procurement_items | |
| quantity_needed | numeric(10,2) | |
| quantity_on_hand_snapshot | numeric(10,2)? | from stock at check time |
| status | enum `procurement_need_status` (`needed`,`have_it`,`to_buy`,`to_borrow`,`ordered`,`received`,`cancelled`) | |
| source | enum `procurement_need_source` (`manual`,`recipe_rollup`,`template`) | |
| source_ref_type, source_ref_id | varchar(40)?, uuid? | soft ref, e.g. `kitchen.menu_meal` for kitchen rollups (was FK `menu_meal_id`) |
| spend_request_ref_id | uuid? | soft ref to `finance.spend_request`, set by the `finance.spend.decided` event (was FK `spend_request_id`) |
| supplier_id | uuid? FK procurement_suppliers | |
| needed_by | date? | |
| owner_person_id | uuid? FK | |
| **IX** | (edition_id, status), (item_id) | |

---

## 6. Logistics

### `logistics_places`
| id · name · kind enum (`pickup`,`storage`,`supplier`,`site`,`airport`,`city_area`) · address_text? · lat/lng numeric? · notes |

### `logistics_vehicles`
| id · edition_id · label ("Tam's bakkie", "Hired truck", "Tractor (art car)") · kind enum (`car`,`bakkie`,`truck`,`trailer`,`container_truck`,`mutant_vehicle`) · owner_person_id? · driver_person_id? · seats smallint? · cargo_notes text? · cargo_capacity_kg? |

### `logistics_loads`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| edition_id | uuid FK | |
| direction | enum (`outbound`,`return`,`internal`) | |
| name | text | "Container Day: Container A", "Mon perishables run" |
| vehicle_id | uuid? FK | rough assignment only |
| origin_place_id | uuid FK logistics_places | |
| destination_place_id | uuid FK logistics_places | |
| departs_at | timestamptz? | |
| status | enum `logistics_load_status` (`planned`,`packing`,`in_transit`,`delivered`,`cancelled`) | |
| delivered_confirmed_at | timestamptz? | |
| delivered_confirmed_by_person_id | uuid? FK | |
| task_id | uuid? FK tasks | the packing task |

### `logistics_load_items`
| id · edition_id · load_id FK? (**null = needs a load**, e.g. created from a `procurement.need.marked_critical` event) · source_ref_type? · source_ref_id? (soft ref to `procurement.item` or `procurement.need`; was FKs `item_id`, `procurement_need_id`) · description text (item name copied in, so it reads without procurement) · quantity numeric · is_critical boolean · packed_at? · packed_by? · delivered_at? · return_load_id? FK logistics_loads | IX (load_id), partial IX on is_critical |
A view `logistics_v_critical_unassigned` drives the load-gap alert: critical load items with no load, or on a load with no destination. It reads only logistics tables; procurement feeds it through the event.

### `logistics_travel_plans` (members' own travel)
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| edition_member_id | uuid FK | |
| direction | enum (`to_burn`,`from_burn`) | |
| mode | enum (`offering_ride`,`need_ride`,`own_arrangement`,`camp_shuttle`,`bus`) | |
| area_place_id | uuid? FK logistics_places | "Cape Town CBD", "Airport" |
| area_detail | text? | |
| window_start, window_end | timestamptz | |
| seats_offered / seats_needed | smallint? | |
| carries_cargo | boolean | water/camp gear |
| status | enum (`looking`,`space_available`,`full`,`sorted`) | |
| **U** | (edition_member_id, direction) | |

### `logistics_ride_matches`
| id · driver_plan_id FK · passenger_plan_id FK · status enum (`proposed`,`accepted`,`declined`,`cancelled`) | U (driver_plan_id, passenger_plan_id). Phone numbers become visible to both people only when `accepted`.

---

## 7. Finance (no ledgers, no member dues)

### `finance_approval_policies`
| id · edition_id · name · min_cents bigint · max_cents bigint? · currency · within_budget_only boolean · steps in `finance_policy_steps` (position, approver_kind team_lead/role, role_id FK) · is_active | Evaluated by `src/modules/finance/rules/approval-policy.ts`; first matching policy by amount wins. Placeholders: < R1,500 in budget → team lead; ≤ R10,000 → finance approver; > R10,000 or over budget → finance approver + camp lead.

### `finance_budgets`
| id · edition_id · team_id FK? (null = camp-level) · name · amount_cents · currency · status enum (`draft`,`approved`,`closed`) · approved_by_person_id? · approved_at? · notes | U (edition_id, team_id) where team_id not null |
Optional `finance_budget_lines` (id, budget_id, category enum from the Mad Hatters categories, label, amount_cents, priority must/target/nice) for teams that want detail.

### `finance_spend_requests`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| edition_id | uuid FK | |
| ref_seq | integer | per edition sequence |
| ref_code | varchar(20) U | `OEA-SR-017` (ported generator, own prefix function) |
| budget_id | uuid FK finance_budgets | |
| budget_line_id | uuid? FK | |
| team_id | uuid FK | |
| requester_person_id | uuid FK | |
| title | text | |
| justification | text? | |
| estimated_cents | bigint | |
| currency | char(3) | |
| supplier_name | text? | copied in (was FK `supplier_id` to suppliers) |
| supplier_ref_id | uuid? | soft ref to `procurement.supplier` |
| source_ref_type, source_ref_id | varchar(40)?, uuid? | e.g. `procurement.need` when created from a `procurement.need.purchase_requested` event |
| task_id | uuid? FK tasks | the purchase task |
| status | enum `finance_spend_status` (`draft`,`submitted`,`needs_info`,`approved`,`rejected`,`cancelled`,`purchased`,`closed`) | |
| policy_id | uuid? FK finance_approval_policies | snapshot at submit |
| current_step | smallint | |
| submitted_at, decided_at | timestamptz? | |
| **IX** | (edition_id, status), (team_id), (requester_person_id) | |

### `finance_approvals` (append-only)
| id · spend_request_id FK · step smallint · approver_person_id FK · decision enum (`approved`,`rejected`,`needs_info`) · comment · decided_at | check approver ≠ requester (enforced in the finance rules + trigger). U (spend_request_id, step) for final decisions.

### `finance_expenses`
| id · edition_id · spend_request_id FK? (unplanned expenses allowed, flagged) · payer_person_id FK (who paid out of pocket, or "camp card") · paid_with enum (`personal`,`camp_card`,`camp_cash`,`supplier_invoice`) · amount_cents · currency · fx_rate_to_zar? · spent_on date · description · receipt_document_id FK? · status enum (`submitted`,`approved`,`rejected`,`needs_info`) · approved_by_person_id? · category (incl. `damage_reimbursement`) |
Committed = Σ approved spend_requests without closing expenses; Actual = Σ approved expenses. **Computed in queries/views, never stored as editable numbers.**

### `finance_reimbursements`
| id · edition_id · payee_person_id FK · amount_cents · currency · status enum (`owed`,`paid`,`declined`) · paid_at? · paid_by_person_id? · method_note text (e.g. "EFT 12 Mar", no account numbers) |
`finance_reimbursement_expenses` (reimbursement_id, expense_id) PK both, to batch several expenses.

Views: `finance_v_budget_summary` (budget, committed, actual, remaining per team), `finance_v_inbox` (awaiting my approval).

---

## 8. Kitchen

### `kitchen_recipes`
| id · name · category enum (`breakfast`,`dinner`,`snack`,`sauce`,`drink`) · base_servings smallint · instructions text · prep_location enum (`cape_town`,`on_site`) · storage enum (`fresh`,`frozen`,`dry`) · diet_tags text[] (`vegetarian`,`vegan`,`gluten_free`,`dairy_free`,`nut_free`) · source_year smallint? · notes |

### `kitchen_recipe_ingredients`
| id · recipe_id FK cascade · ingredient_name text · procurement_item_ref_id uuid? (soft ref to `procurement.item`; was FK `item_id`) · quantity numeric(10,3) · unit varchar · scaling enum (`linear`,`fixed`,`step`) · step_size numeric? · notes |
`fixed` for things like "1 bottle of oil regardless", `step` to round up to pack sizes.

### `kitchen_menu_meals`
| id · edition_id · day date · meal enum (`breakfast`,`dinner`,`snacks`,`crew_meal`) · headcount_mode enum (`on_site`,`fixed`) · headcount_fixed smallint? · freshness enum (`fresh`,`frozen`) · notes ("no fresh cooking: acid-train day") · shift_slot_ref_id uuid? (soft ref to `shifts.slot`; was FK `shift_slot_id`) | U (edition_id, day, meal) |

### `kitchen_menu_meal_recipes`
| menu_meal_id FK · recipe_id FK · servings_override smallint? · is_diet_alternative boolean | PK (menu_meal_id, recipe_id)

### Diet and allergies (no kitchen table)
Diet and allergies live on the base `edition_members` row (§1), set by the member on their profile or by the CSV import. The kitchen module has no dietary table of its own: it reads them through the base people API, as counts per diet for its menus and by name only for callers with `member.view_dietary` (holders of `kitchen_sensitive_viewer`, which an admin grants to the kitchen leads). Same rules as every other normal field: no consent flag, no purge date, no per-view audit; never in app logs or error messages.

*Open for the kitchen module (not decided):* the earlier draft also had `intolerances` and an `allergy_severity` (severe flagged to kitchen leads). If the kitchen module needs them, they'd be new base columns on `edition_members` (a base PR), with the same rules.

---

## 9. Programming

### `programming_venues`
| id · edition_id · name ("Art car: sunset link-up", "Art car: night spot", "Camp chill area", "Partner camp: X") · kind enum (`art_car`,`art_car_stop`,`camp`,`partner_camp`,`other`) · sound_zone_key varchar? (matches `programming_sound_rules.zone_key`) · notes |

### `programming_performers` (no login)
| id · name · dj_name? · email? · person_id? FK people (if also a member) · is_member boolean · first_time_at_oeaasies boolean · source enum (`application_import`,`manual`) · notes · feedback_flag enum (`none`,`positive`,`concern`) |

### `programming_activities`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| edition_id | uuid FK | |
| kind | enum `programming_activity_kind` (`dj_set`,`linkup`,`art_car_run`,`workshop`,`community`,`meeting`,`other`) | |
| title | text | |
| venue_id | uuid FK programming_venues | |
| starts_at, ends_at | timestamptz | |
| status | enum (`draft`,`confirmed`,`cancelled`) | |
| requirements | text? | gear, light/VJ shift before set |
| linked_shift_slot_ref_id | uuid? | soft ref to `shifts.slot`, e.g. light shift (was FK `linked_shift_slot_id`) |
| conflict_override_reason | text? | required to save over a warning |
| published_at | timestamptz? | |
| **IX** | (edition_id, starts_at), (venue_id, starts_at) | |
Change history is the audit log (`entity_type='activity'`), so "what changed since the printout" works.

### `programming_activity_hosts`
| activity_id FK · person_id? FK · performer_id? FK · role enum (`host`,`dj`,`b2b`,`tech`,`vj`) | check exactly one of person/performer.

### `programming_sound_rules` (editable, warnings only)
| id · edition_id · zone_key (`louder_zone`,`loud_zone`,`open_camping`,`quiet`) · days_of_week smallint[] · quiet_from time · quiet_to time · max_db smallint? · rule_text · source_doc_slug (afrikaburn-rules corpus) · as_of_year smallint · is_confirmed boolean |

---

## 10. AfrikaBurn obligations

### `obligation_details` (1:1 extension of a task with `kind = 'obligations.obligation'`)
| Column | Type | Notes |
|---|---|---|
| task_id | uuid PK FK tasks | |
| authority | enum (`afrikaburn`,`dmv`,`fuel_team`,`sound_team`,`supplier_depot`,`quicket`,`internal`) | |
| category | enum (`registration`,`wap`,`mutant_vehicle`,`sound`,`lnt`,`fire_safety`,`gas_fuel`,`water_ice`,`food_safety`,`supplier`,`tickets`,`exit_signoff`,`other`) | |
| source_url | text? | |
| source_doc_slug | text? | rules corpus slug |
| date_confirmed | boolean | false → "TBC" |
| previous_year_date | date? | "2026: 28 Feb" |
| required_documents | text[] | |
| submitted_at | timestamptz? | |
| confirmation_ref | text? | |

---

## 11. Documents, knowledge, announcements, exports

### `documents`
| id · storage_key text U (R2 key) · filename · mime_type · size_bytes bigint · sha256 · uploaded_by_person_id · visibility enum (`members`,`team`,`leads`,`admins`) · team_id? · kind enum (`attachment`,`receipt`,`blueprint`,`photo`,`knowledge_dump`,`binder`,`export`,`guide`) · edition_id? |

### `document_links`
| id · document_id FK · entity_type varchar (`task`,`project`, plus namespaced module types, see right) · entity_id uuid · label? | IX (entity_type, entity_id). Polymorphic on purpose (one upload path); integrity checked in the base documents service. Module entity types are namespaced: `finance.expense`, `finance.spend_request`, `logistics.load`, `kitchen.recipe`, `programming.activity`, `procurement.item`.

### `guide_pages`
| id · edition_id · slug · title · body_md · section (`what_to_bring`,`provided`,`rules`,`fees_info`,`build`,`strike`,`moop`,`faq`) · audience enum (`public_members`,`confirmed_members`,`leads`) · source_note · position | Seeded from member-kb docs; the in-app FAQ (no AI).

### `announcements`
| id · edition_id · author_person_id · title · body_md · audience enum (`all`,`team`,`leads`) · team_id? · pinned_until? · published_at? |

### `export_jobs`
| id · edition_id · requested_by_person_id · kind enum (`edition_zip`,`finance_csv`,`wap_list`,`arrival_manifest`,`shift_rota`)` (Binder files are `binder_builds`, owned by the binder module) · include_sensitive boolean · status enum (`queued`,`running`,`done`,`failed`) · document_id? FK · error? · finished_at? |

### `binder_builds`
| id · edition_id · version integer · generated_at · generated_by_person_id · config jsonb (sections, contact visibility) · pdf_document_id FK · html_document_id FK? | U (edition_id, version)

Knowledge dumps are tasks (`kind = knowledge_dump`) with attached documents; no separate table.

---

## 12. Notifications, jobs, audit

### `notifications`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| recipient_person_id | uuid FK | |
| type | varchar(40) | base: `task.assigned`, `task.due_soon`, `task.overdue`, `task.unowned`, `task.dependency_risk`, `claim.decided`, `mention`, `announcement`; modules (namespaced, registered in the manifest): `shifts.gap`, `logistics.load_gap`, `finance.spend.awaiting_approval`, `finance.spend.decided`, `obligations.due` |
| entity_type, entity_id | varchar, uuid | |
| title | text | no sensitive fields (rendered from safe fields only) |
| body | text? | |
| href | text | in-app link, e.g. `/tasks/<id>` (added in B2.10) |
| urgency | enum (`immediate`,`digest`) | |
| read_at | timestamptz? | |
| digested_at | timestamptz? | included in a digest email |
| alert_state_id | uuid? FK | |
| **IX** | (recipient_person_id, read_at), (recipient_person_id, digested_at) where digested_at is null | |

### `notification_preferences`
| person_id FK · type varchar ('*' default) · channel enum (`in_app`,`email_immediate`,`email_digest`,`off`) · digest_frequency enum (`daily`,`weekly`) | PK (person_id, type). Some types can't be turned off (approvals for approvers, obligations for owners).

### `alert_rules` (tunable parameters; logic is code)
| key varchar PK (base: `due_soon`, `overdue`, `unowned`, `dependency_risk`; modules: `shifts.gap`, `logistics.load_gap`, `finance.approval_waiting`, `obligations.unconfirmed_date`) · enabled · typed day thresholds, null = code default: remind_days_before · remind_again_days_before · escalate_lead_after_days · escalate_camp_after_days · within_days · escalate_within_days (CHECK 0–60) · updated_by_person_id |

### `alert_states` (dedupe + escalation)
| id · rule_key · entity_type · entity_id · level smallint (0 owner, 1 team lead, 2 camp lead) · fingerprint text (e.g. due_at value; change resets) · first_fired_at · last_fired_at · resolved_at? | **U** (rule_key, entity_type, entity_id, level, fingerprint)

### `email_outbox`
| id · to_person_id FK · to_email · template varchar · payload jsonb · dedupe_key text U · status enum (`pending`,`sending`,`sent`,`failed`,`suppressed`) · attempts smallint · next_attempt_at · provider_message_id? · last_error? · sent_at? · created_at | IX (status, next_attempt_at). Daily sends capped per setting (100 on Resend free); overflow defers to next day with priority to `immediate`.

### `job_runs` (append-only)
| id · job varchar (base: `tick`,`recurrence`,`digest`,`purge_sensitive`,`backup_check`; modules: `<module>.<job>`) · started_at · finished_at? · status enum (`running`,`succeeded`,`failed`) · stats jsonb · error? | Heartbeat to healthchecks.io after success.

### `audit_events` (append-only)
| Column | Type | Notes |
|---|---|---|
| id | uuid PK (v7) | |
| occurred_at | timestamptz | |
| actor_person_id | uuid? FK | null = system job |
| actor_kind | enum (`person`,`system`,`import`) | |
| action | varchar(60) | `task.status_changed`, `spend.approved`, `role.granted`, `member.status_changed`, `export.created`, … |
| entity_type | varchar(40) | |
| entity_id | uuid | |
| edition_id | uuid? | |
| changes | jsonb? | `{field: [before, after]}`; phone, emergency contact, diet and allergy values recorded as `"[redacted]"` (the row says *that* they changed) |
| significance | enum (`activity`,`significant`,`security`) | feed vs audit filters |
| request_id | text? | |
| ip_hash | text? | |
| **IX** | (entity_type, entity_id, occurred_at), (actor_person_id, occurred_at), (action, occurred_at) | |
Grant: the app's DB role has INSERT/SELECT only on this table (no UPDATE/DELETE).

---

### `module_settings` (base; feature flags)
| module_id varchar(40) PK (matches the manifest id) · enabled boolean · audience enum (`everyone`,`pilot`,`admins`) · updated_by_person_id FK? · updated_at | One row per module, created from `manifest.flag` on first boot. Changes are audited. People in the pilot audience hold the `pilot` role (kind `system`) in `role_assignments`.

### `domain_events` (base; append-only outbox)
| id uuid PK (v7) · name varchar(80) (`procurement.need.marked_critical`) · version smallint · payload jsonb (validated against `src/contracts/events/*`; no sensitive fields) · emitted_by_module varchar(40) · actor_person_id? · edition_id? · occurred_at | IX (occurred_at). Written in the same transaction as the change that caused it.

### `domain_event_deliveries` (base)
| id · event_id FK domain_events · handler_module varchar(40) · status enum (`pending`,`done`,`failed`,`skipped`) · attempts smallint · next_attempt_at · last_error? · done_at? | **U** (event_id, handler_module). Retried by the jobs tick; `skipped` when the handling module is switched off.

---

## 13. Sensitive-data rules (enforced in `src/base/authz`, each module's `permissions.ts`, and tests)

Phone numbers and emergency contacts are the sensitive personal fields. Diet and allergies are listed here only to say who sees them by name; they are normal camp data.

| Data | Who sees it | Retention |
|---|---|---|
| Phone, emergency contact | Self; team leads of the person's teams; admins; ride partner after an accepted match (phone only); Binder per config | Emergency contact cleared 60 days after event end (job) |
| Diet and allergies (by name) | **Not sensitive** (Ruchir, 11 Oct 2026): self; holders of `kitchen_sensitive_viewer` (`member.view_dietary`, granted by an admin, seeded for the kitchen leads); admins. No consent flag, no per-view audit. Never in app logs, errors or audit values | With edition |
| Diet counts | Kitchen team (kitchen module, aggregate only) | With edition |
| Admin notes | Admins only | With edition |
| Payment status (imported) | Self; admins; finance approver | With edition |
| Spend/expense detail | Requester; team leads of that team; finance approvers; camp lead; admins | Permanent (audit) |
| ID/passport | **Not stored** | — |

## 14. Main indexes summary (dashboard paths)
- Readiness per team: `tasks (edition_id, status, due_at)` + partial unowned index + `task_dependencies (depends_on_task_id)`.
- My work: `tasks (owner_person_id, status)` + `task_assignments (person_id, status)` (base) + the shifts module's my-items provider over `shift_signups (person_id, status)`.
- Available work: `tasks` partial index `where claim_mode <> 'closed' and status = 'todo'` + GIN on `required_skill_ids`.
- Finance inbox: `finance_spend_requests (edition_id, status)`.
- Load gaps: `logistics_v_critical_unassigned` over `logistics_load_items` (partial index on is_critical) left join `logistics_loads`.
- Digest: `notifications (recipient_person_id) where digested_at is null and urgency = 'digest'`.

## 15. What changed for the modular architecture (10 Oct 2026)

| Before | After | Why |
|---|---|---|
| `items`, `inventory_locations`, `inventory_stock`, `inventory_movements`, `suppliers` | `procurement_items`, `procurement_locations`, `procurement_stock`, `procurement_stock_movements`, `procurement_suppliers` | procurement module prefix (`procurement_needs` already fit) |
| `places`, `vehicles`, `loads`, `load_items`, `travel_plans`, `ride_matches` | `logistics_` + same name | logistics module prefix |
| `approval_policies`, `budgets`, `budget_lines`, `spend_requests`, `approvals`, `expenses`, `reimbursements`, `reimbursement_expenses`; views `v_budget_summary`, `v_finance_inbox` | `finance_` + same name; `finance_v_budget_summary`, `finance_v_inbox` | finance module prefix |
| `recipes`, `recipe_ingredients`, `menu_meals`, `menu_meal_recipes`, `dietary_profiles` | `kitchen_` + same name (`kitchen_dietary_profiles` later removed, see the next table) | kitchen module prefix |
| `venues`, `performers`, `activities`, `activity_hosts`, `sound_rules` | `programming_` + same name | programming module prefix |
| `shift_*`, `obligation_details`, `export_jobs`, `binder_builds` | unchanged | already carried the module prefix (`shift_`, `obligation_`, `export_`, `binder_`) |
| Module enums (`item_category`, `need_status`, `load_status`, `spend_status`, `activity_kind`, `signup_status`) | `procurement_item_category`, `procurement_need_status`, `logistics_load_status`, `finance_spend_status`, `programming_activity_kind`, `shift_signup_status` | enums follow the table prefix |
| FKs across modules: `procurement_needs.menu_meal_id`, `.spend_request_id`; `load_items.item_id`, `.procurement_need_id`; `spend_requests.supplier_id`; `recipe_ingredients.item_id`; `menu_meals.shift_slot_id`; `activities.linked_shift_slot_id` | soft references (`*_ref_id`, with `*_ref_type` where needed) plus copied-in names (`supplier_name`, `ingredient_name`, load item `description`) | modules may only FK to their own or base tables |
| `edition_members.shift_quota` | `shift_member_quotas` | module data doesn't live on base tables |
| `tasks.kind` enum `task_kind` | `varchar(40)` checked against kinds registered in manifests; plus `tasks.source_ref_type/id` | modules add task kinds without a base migration |
| — | new base tables `module_settings`, `domain_events`, `domain_event_deliveries` | feature flags and cross-module events |
| Notification types, alert rule keys, job names | namespaced by module (`finance.spend.awaiting_approval`) | one registry, no collisions |

### Diet and allergies (13 Oct 2026)

| Before | After | Why |
|---|---|---|
| `kitchen_dietary_profiles` (diet, intolerances, `allergies_text` sensitive, `consent_kitchen_named`, `purge_after`; every named view audited as `dietary.viewed_named`) | `edition_members.diet` + `edition_members.allergies` (B1), read with base `member.view_dietary` | Ruchir (11 Oct): diet and allergies are normal camp data kitchen leads see by name. Resolves the FLAG in `docs/specs/b1-people-teams-roles.md` §6 |
