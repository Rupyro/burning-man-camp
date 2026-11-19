# Setting up the app for your camp

A walk-through for a camp lead making their own copy, after the hosting steps in the
[README](../README.md#set-up-your-own-camp) (repo, free Vercel project, free Neon database,
environment variables). It takes about an hour, and all of it is plain files in the repo.

> Status, Nov 2026: the starting config still describes the AfrikaBurn camp the app came from
> (rand, South African time). The switch to a Burning Man default ("Your Camp", dollars, Pacific
> time) is waiting in a draft pull request. Running `pnpm camp:setup` gives you a Burning Man
> camp either way.

## 1. Answer the setup questions

```bash
pnpm camp:setup
```

Seven steps rewrite `camp.config.ts`. Nothing is written until you confirm at step 7.

1. **Camp name.**
2. **Short description**, shown on the login page and in link previews.
3. **Camp type, size and packs.** The type decides which Placement screens you see (open camping
   hides the Statement of Intent and standing history). Types: theme camp (placed), art support,
   mutant vehicle, work or civic support, open camping. Then pick the packs you need:

   | Pack | Turns on |
   |---|---|
   | Sound (pulls in Big power) | sound officer role; sound plan and neighbor log* |
   | Mutant vehicle (pulls in Big power) | DMV contact role, vehicle licensing steps on Camp info, art car shifts; driver roster* |
   | Big power | power and generator planning (the fuel plan at `/fuel` is open to every camp) |
   | Fire and flame effects | fire safety officer role; flame-effect register* |
   | Kitchen and food gifting | kitchen lead role; meal plan and the food-permit check* |
   | Art project | art lead role, art registration steps on Camp info |
   | Village or HUB | village liaison role; shared resources with partner camps* |
   | Workshops and offerings | the camp schedule and its event-guide export* |

   \* In a draft pull request waiting for review (see [`label-queue.md`](label-queue.md)).

   Packs you don't pick stay hidden. You can add one later by running the setup again.
4. **Money.** Currency, symbol and the yearly camp fee. Amounts are stored in cents.
5. **Joining and Family years.** Whether returning members get a shorter application.
6. **Traditions.** Optional camp traditions carried over from the original camp. Most camps pick
   none.
7. **Check and save.** The new config is checked before it's written.

Then run `pnpm format` and commit.

## 2. Pick the event

`camp.config.ts` → `event.pack` picks the event pack in `camp-events/`: `burning-man` (Black Rock
City, Pacific time, US dates) or `afrikaburn`. The pack holds the event dates, the yearly
deadlines shown on `/year`, the event's rules for camps on `/camp`, the water allowance for
`/water`, the fuel storage limit for `/fuel`, and the first-timer reading. Every date and rule
links to its source.

**Every year:** when Burning Man posts the new dates, update `camp-events/burning-man/pack.ts`.
Entries marked `"pattern"` are last year's date moved to the same weekday. Change them to
`"official"` once posted, and fix the date if it moved.

## 3. Write your camp's words

| File | What it is |
|---|---|
| `camp-content/about.ts` | Who you are, for applicants and Camp info |
| `camp-content/guide.ts` | Member guide and camp rules |
| `camp-content/packing.ts` | Packing notes (gallons for Black Rock City) |
| `camp-content/leave-no-trace.ts` | Your Leave No Trace and Exodus plans, printed in the playa binder |
| `camp-content/policies.ts` | Spending approval names and limits. Placeholders: your treasurer sets the real ones |
| `camp-content/standing.ts` | Placement standing and MOOP Map grade, one line per year. Leave it empty for a new camp |

## 4. Make it look like you

Swap the colours, fonts and backdrop in `camp-art/` (see `camp-art/README.md`). Day and night
themes follow sunrise and sunset at the event site.

## 5. Try it on fake data first

Set `DEMO_MODE=true` and `DEMO_RESEED=1` in Vercel for one deploy, then sign in as
`admin@example.test`, `lead@example.test` or `member@example.test`. All the demo people are
made up. Two example camps in `camp-presets/` (a 20-person art support camp and a 150-person
sound camp) show other set-ups. Copy one over `camp.config.ts` locally to try it.

When you're ready for real members, turn demo mode off and invite your leads (`pnpm invite you@example.com "Your Name"`, or from the admin screens).

## 6. Pages a camp lead uses most

| Page | For |
|---|---|
| `/year` | The camp-lead year: every event deadline by month, with sources |
| `/camp` | Camp info: guide, rules, the event's rules, first-timer reading, key dates, leads |
| `/countdown` | Days to build and to the burn, and what to do this week |
| `/water`, `/fuel` | How much water and generator fuel to bring, and in how many containers |
| `/playa-binder` | One printable page: on-site dates, camp rules, Leave No Trace and Exodus plans |
| `/obligations` | The camp's deadlines with owners |

## Keeping it safe

- Secrets (database URLs, the auth secret, API keys) go in Vercel's environment variables or your
  camp's password manager, never in git.
- The app doesn't collect money or store ticket numbers, license numbers or ID numbers.
- Each camp's copy has its own database. Nothing is shared between camps.
