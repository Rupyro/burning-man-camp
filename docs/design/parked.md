# Parked design features

Things we built, took out of the UI on purpose, and kept so they can come back.

## Sand-mound "dust piles" (parked Oct 19, 2026)

- **What:** the little sand piles drawn in the bottom-right corner of cards, tiles and the countdown.
- **Why parked:** Remo's Oct 19 review: the screens were too busy. Ruchir: "let's just remove them from the UI. Maybe I'll come back to fix them later."
- **Where it lives:** `src/app/parked/sand-mound.css` (the SVG tokens for day and night plus the rule). It is not imported, so nothing renders.
- **To bring back:** `@import "./parked/sand-mound.css";` in `src/app/globals.css`, then add the `sand-mound` class to the elements that should get a pile (cards got one automatically before via `.bg-card::after`). Re-check the extra bottom padding it adds.
- The dust *gusts* (the animated streak, `src/app/_components/dust-gust.tsx`) are separate and still on.
