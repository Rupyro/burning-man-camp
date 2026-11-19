# Setting up the app for your camp

A walk-through for a camp lead making their own copy, after the hosting steps in the
[README](../README.md#set-up-your-own-camp) (repo, free Vercel project, free Neon database,
environment variables). It takes about an hour, and all of it is plain files in the repo.

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
   | Sound (pulls in Big power) | sound officer role; sound plan and neighbor log |
   | Mutant vehicle (pulls in Big power) | DMV contact role, vehicle licensing steps on Camp info, art car shifts; driver roster |
   | Big power | power and generator planning (the fuel plan at `/fuel` is open to every camp) |
   | Fire and flame effects | fire safety officer role; flame-effect register |
   | Kitchen and food gifting | kitchen lead role; meal plan and the food-permit check |
   | Art project | art lead role, art registration steps on Camp info |
   | Village or HUB | village liaison role (manages the shared resources); shared resources with partner camps |
   | Workshops and offerings | schedule lead role (manages the schedule); the camp schedule and its event-guide export |

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

To add another event (a regional burn, for example), see [Event packs](event-packs.md).

**Exodus sweep crew:** `exodus.sweepCrew` in `camp.config.ts` sets how many people stay for the final
line sweep: max(min, ceil(campers / perCampers)). The shipped 2 and 10 are a placeholder, not a
Burning Man rule. Set your own.

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

## 5. Host it: Vercel and Neon from the command line

The README's hosting steps use the Vercel website. The same thing from a terminal, in your camp's
folder (free Hobby plan, free Neon plan; checked Nov 2026):

```bash
vercel login
vercel project add your-camp             # the site becomes https://your-camp.vercel.app
vercel link --project your-camp --yes
vercel integration add neon --name your-camp-db -m auth=false -m region=iad1
```

`vercel.json` tells Vercel this is a Next.js app, so the project needs no framework setting.
The Neon step creates a free database and sets `DATABASE_URL` and `DATABASE_URL_UNPOOLED` on the
project. Pass `-m auth=false`, or Neon also turns on its own sign-in service, which the app
doesn't use. `iad1` (Washington, DC) is next to Vercel's default region.

Then add the other production variables. Pipe each value in so it never lands in your shell
history:

```bash
openssl rand -base64 32 | vercel env add BETTER_AUTH_SECRET production --sensitive
openssl rand -hex 24 | vercel env add CRON_SECRET production --sensitive   # 16+ characters
printf %s https://your-camp.vercel.app | vercel env add BETTER_AUTH_URL production
printf %s America/Los_Angeles | vercel env add CAMP_TIMEZONE production
printf %s console | vercel env add EMAIL_ADAPTER production   # emails go to the logs for now
printf %s 1 | vercel env add SKIP_EXTERNAL_SERVICES production
```

Without `CRON_SECRET` the daily reminder job refuses every call; shorter than 16 characters and
the app won't start.

Deploy with `vercel deploy --prod`. Every production deploy runs the database migrations first,
so the first deploy also creates the tables. If you ran `vercel env pull`, delete the `.env.local`
it wrote when you're done: it holds the production database address, and local commands such as
`pnpm seed` read it, so they would run against production.

## 6. Try it on fake data first

Set `DEMO_MODE=true` and `DEMO_RESEED=1` in Vercel and deploy once. That deploy fills the database
with made-up people, shifts and deadlines (`pnpm seed:demo`), only for the packs you turned on.
Then remove `DEMO_RESEED` (`vercel env rm DEMO_RESEED production`) so later deploys leave the data
alone. The demo seed only adds missing rows, so to start over, empty the database first.

Sign in from the role picker on `/login`, or as `admin@example.test`, `lead@example.test` or
`member@example.test`. All the demo people are made up. Two example camps in `camp-presets/` (a
20-person art support camp and a 150-person sound camp) show other set-ups. Copy one over
`camp.config.ts` locally to try it.

When you're ready for real members, empty the database, turn demo mode off and invite your leads
(`pnpm invite you@example.com "Your Name"`, or from the admin screens).

## 7. Pages a camp lead uses most

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
