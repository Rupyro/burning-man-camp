# Self-hosted fonts

Latin-subset woff2 files from Google Fonts, all under the SIL Open Font License 1.1:
Fraunces (variable: wght, opsz, SOFT, WONK), Inter (variable wght), Syne (wght 700-800),
Special Elite (400). Loaded with `next/font/local` in `src/app/fonts.ts`, so builds and
browsers never call Google. To refresh, fetch the css2 API for the same families and axes and
download the `/* latin */` woff2 URLs.
