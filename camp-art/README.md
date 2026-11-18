# camp-art

The camp's own art. `backdrop/` holds the logo mark, wordmark and the backdrop photos.
`scripts/sync-camp-art.mjs` copies each folder here into `public/` before `dev` and `build`
(and in the Vercel build), so the app serves them at the same URLs as before, e.g.
`/backdrop/logomark.png`. `public/backdrop/` is generated and gitignored: swap art here.

`theme.css` holds the brand palette and the day/night colour variables (imported by
`src/app/globals.css`). `fonts.ts` and `fonts/` hold the self-hosted fonts (bundled by next/font,
not copied to `public/`).
