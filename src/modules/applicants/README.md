# `applicants`: applying to join, and Open applications

Spec: `docs/specs/applicants.md`.

| | |
|---|---|
| Route | `/apply` (applicants: status tracker, to-do, required documents, about the camp), `/apply/form` (PLACEHOLDER form), `/apply/review` and `/apply/review/<id>` (Open applications, leads and admins) |
| Tile | "Applications", order 105 (reviewers; applicants never see the home page) |
| Access | `applicants.apply` or `applicants.review`; admins always |
| Capabilities | `applicants.apply`, `applicants.review`, `applicants.decide` |
| Tables | `applicant_applications`, `applicant_documents` |
| Migrations | `migrations/`, table `__drizzle_migrations_applicants` |
| Events emitted | `applicants.application.accepted` |
| Events handled | `finance.fee.created`, `finance.fee.paid` |
| Base APIs | `ctx.membership.confirmJoined` (joined = paid + every requirement, spec §2) |
| My items | reviewers: "N new applications to review", interviews in the next 7 days |
| Export | both tables; `answers` and `lead_note` blanked by default |
| Sensitive data | form answers and the lead note (reviewers only); no contacts shown |
| Seed | 14 fake applications at every stage, plus the demo Applicant persona (interview booked) |

Not in V1: the real application form (Ruchir is sending it; the form is a clearly marked
PLACEHOLDER), file uploads, self-booked interview slots, capacity cap / automatic waitlist,
taking payment (Finance records it; demo only).

With Finance switched off, accepting still works, but no fee is created, so nobody can join
through the app; an admin confirms them in People instead.
