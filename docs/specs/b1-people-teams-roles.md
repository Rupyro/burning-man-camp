# Spec B1: people, teams, roles, edition, permissions, CSV member import

**Status:** draft for Ruchir's review (11 Oct 2026, ET). **Slice:** `docs/PLAN.md` B1, minus the
landing page design (Ruchir wants to discuss design first) and minus announcements / camp guide
(follow-up). Tables: `docs/DATA_MODEL.md` §1–2. Contract: `docs/MODULE_RULEBOOK.md` §4.

## 1. What B1 delivers

- **Edition (camp year):** title, status, **member capacity as a setting** (default 70), and
  editable anchor dates (`build_start`, `container_day`, …) with a "confirmed?" flag.
- **People** (persist across years) and a **per-year member record** (`edition_members`): status,
  imported payment status (read-only), arrival/departure, build/strike commitment, tent choice,
  diet and allergies, availability note.
- **Profile fields:** display name, playa name, pronouns, country, phone, bio, first burn year,
  emergency contact, directory visibility, skills (catalogue), availability windows.
- **Teams** and **team memberships** (`lead` / `co_lead` / `member`), per edition.
- **Roles** (camp-wide hats) and **role assignments**, per edition or permanent.
- **Capabilities** computed on the server from roles + team memberships + the record.
- **Admin-only notes** in their own table.
- **CSV member import** for Jaxon's confirmed-member sheet: column mapping, validation report,
  dry run, apply, idempotent on email, possible duplicates flagged (never silently merged), audited.
- **Screens:** My profile (`/me`), People directory (`/people`), a person's page (`/people/[id]`,
  with status, team, role and note controls for those allowed), Teams (`/teams`), Import
  (`/people/import`). Plain, functional markup only; the landing page keeps
  its current look and just links to these screens when the caller is allowed.
- **Seed:** ~100 obviously fake members, 11 leads, 12 teams, roles, skills and profile data.

## 2. Ground rules (from Ruchir)

1. **Roles and teams are separate things.** A person can hold several roles and be on several
   teams. Leading a team is a team membership with `role = lead`, not a role. Leading a *shift* is
   a per-shift assignment that the shifts module will own; it gives no team or camp-wide power.
   Nothing in code hard-codes the org chart (no "the kitchen lead is X", no team key checks in base
   permissions). Team keys only appear in seed data.
2. **Diet and allergies are normal camp data**, not sensitive: kitchen people see them by name.
   They are still never written to logs, error messages or audit `changes` (AGENTS.md rule 7: the
   audit row records *that* they changed, as `"[redacted]"`).
3. **Basic security:** every check runs on the server, per action and per record. No
   attacker-focused hardening (rate limits, anomaly detection, field encryption) in B1.
4. **Capacity is a setting** (`editions.member_capacity`), not a constant.

## 3. Capabilities (base)

All are pure functions of `(actor, resource)` in `src/base/authz/permissions.ts`. "Lead of X" means
`lead` or `co_lead` of that team in the current edition. Admins pass every base capability.

| Capability | Resource | Allowed |
|---|---|---|
| `member.view_directory` | none, or `{personId, teamIds, visibility}` | Confirmed members. A person with `visibility = hidden` is visible only to themselves, admins and leads of one of their teams |
| `member.view_contacts` | none, or `{personId, teamIds?, visibility?}` | Self; leads of one of the person's teams; any confirmed member when the person chose `members_with_contact`. Without a resource: any team lead (unchanged from B0) |
| `member.view_dietary` | `{personId}` | Self; holders of the `kitchen_sensitive_viewer` role ("sees diets and allergies by name"); seed grants it to the kitchen leads |
| `member.view_payment` | `{personId}` | Self; `finance_approver` |
| `member.edit_profile` | `{personId}` | Self (if they have a member record this year); `camp_lead` |
| `member.manage` | none | `camp_lead` (change member status, travel and admin fields of others) |
| `member.admin_notes` | none | Admins only |
| `member.import` | none | Admins only |
| `team.manage` | none | `camp_lead` (create/rename teams, appoint the `lead`) |
| `team.manage_members` | `{teamId, role}` | `camp_lead`; leads of that team, for `co_lead` / `member` only (a lead can't appoint another `lead`) |
| `role.assign` | `{roleKey}` | Admins only (nobody else can hand out roles, including `admin`) |
| `edition.manage` | none | `camp_lead` (capacity, title, anchor dates) |

## 4. Behaviour (Given / When / Then)

### Permissions
- **P1** Given a confirmed member, when they open the directory, then they see confirmed members'
  display name, playa name, country, teams and skills, but **no** email, phone or emergency contact
  unless that person chose "members with contact".
- **P2 (deny)** Given a member, when they request another member's profile through the server
  action or API with that person's id (a crafted request), then phone, email, emergency contact,
  payment status, diet/allergies and admin notes are absent from the response.
- **P3** Given the lead of Gift Projects, when they open a Gift Projects member's page, then they
  see that member's phone and emergency contact. **(deny)** For a member of a team they don't lead,
  they don't.
- **P4** Given a holder of `kitchen_sensitive_viewer`, when they open any member's page, then they
  see diet and allergies by name. **(deny)** A plain member, or a lead of another team, doesn't.
- **P5 (deny)** Given a waitlisted or prospect person, or an alumnus not in this year, when they
  open the directory, then the server refuses (404).
- **P6 (deny)** Given a member, when they try to edit someone else's profile, change a member
  status, read admin notes, import a CSV, assign a role or change the capacity, then the server
  refuses with Forbidden and nothing changes.
- **P7** Given a team lead, when they add a person to their team as `member` or `co_lead`, then it
  works and is audited. **(deny)** When they try to make someone `lead`, or change another team,
  the server refuses.
- **P8** A person can be in 3 teams and hold 2 roles at once, and their capabilities are the union.
- **P9** Leading a team gives no camp-wide powers: a team lead can't change member status, assign
  roles or import.

### Profile
- **F1** Given a member, when they edit their own playa name, phone, country, skills,
  availability, arrival/departure, build/strike, tent, diet and allergies, then it's saved, and an
  audit row records which fields changed, with phone, emergency contact, diet and allergies values
  as `"[redacted]"`.
- **F2 (deny)** A member can't set their own status or payment status (those fields aren't in the
  self-edit form and the server ignores/refuses them).
- **F3** Departure before arrival is refused with a validation message.

### Members, roles, teams, edition
- **M1** Given the camp lead, when they confirm a member and confirmed members are already at the
  edition's capacity, then the change is refused with "capacity reached (70)". Raising the capacity
  first lets it through.
- **M2** Every status change, role grant/revoke and team membership change writes an audit row in
  the same transaction (`member.status_changed`, `role.granted`, `role.revoked`,
  `team.member_added`, `team.member_role_changed`, `team.member_removed`, `edition.updated`,
  `edition.anchor_set`).
- **M3** Admin notes are only returned to admins. They live in `member_admin_notes`, never on the
  member row.

### CSV import
- **I1** Given an admin pastes or uploads a CSV, then the app guesses a column mapping from the
  headers (e.g. "E-mail" → email, "Playa name" → playa name), and the admin can change it.
- **I2 (dry run)** Given a mapping, when the admin runs a dry run, then they get a report per row:
  `create`, `update` (with the changed fields), `unchanged`, `possible duplicate` or `error` (with
  the reason, e.g. "invalid email", "unknown status 'maybe'"). Nothing is written.
- **I3 (apply)** When they apply, then creates and updates are written in one transaction, rows
  with errors are skipped, and one audit row `member.import_applied` records the counts and the
  file name (no personal values).
- **I4 (idempotent)** Applying the same CSV twice changes nothing the second time (all
  `unchanged`), and never creates a second person for the same email (case-insensitive).
- **I5 (duplicates)** A new email whose name matches an existing person (or another row in the same
  file) is flagged `possible duplicate` and is **not** imported unless the admin resolves it as
  "create new person" or "same person as X" (which adds this year's record to X and keeps X's
  email). Two rows with the same email in one file: the second is an error.
- **I6** If the import would take confirmed members over capacity, then the report warns but
  doesn't block (Jaxon's sheet is the source of truth for who paid).
- **I7** Import never sends invites. Inviting stays a separate admin step.
- **I8 (deny)** A non-admin calling the import action gets Forbidden; nothing is written.

### Landing
- **L1** Given anyone signed in, the landing page's "Camp" section links to My profile; confirmed
  members also get People and Teams; admins also get Import. It shows "You are: …" from their real
  roles and team roles (e.g. "Camp lead · Kitchen lead"), or their status if they have none.
  **(deny)** Waitlisted people and alumni get only My profile; camp and team leads get no Import.

## 5. Not in B1
Landing page visual design; announcements and the camp guide; the "my stuff" base tasks (B2);
the Settings → Modules screen; Jaxon's live sheet sync (the CSV import is the manual path);
emergency-contact purge job; per-view audit of contacts or diets (Ruchir: not sensitive).

## 6. Flags (resolved)
- **Resolved 13 Oct 2026: diet/allergies vs DATA_MODEL.md.** `DATA_MODEL.md` and `PLAN.md` used
  to put allergies in the kitchen module as sensitive data (consent flag, purge date, every named
  view audited). Ruchir confirmed they're normal profile data kitchen leads see by name, as B1
  built it: diet and allergies live on `edition_members`, readable via `member.view_dietary`, no
  consent flag, no per-view audit, still never logged. `DATA_MODEL.md` (§1, §8, §12, §13, §15),
  `PLAN.md`, `TRACEABILITY.md` and `REPO_SETUP.md` now say the same.
- **Resolved 13 Oct 2026: who counts as "kitchen leads".** Named diet access is the
  `kitchen_sensitive_viewer` role, which an admin grants (seed grants it to the kitchen lead and
  co-lead), so base permissions never hard-code the team key `kitchen`. A new kitchen lead needs
  the role too.
