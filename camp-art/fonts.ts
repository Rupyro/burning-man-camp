import localFont from "next/font/local";

// Self-hosted woff2 files (latin subset, SIL Open Font License) committed in camp-art/fonts, so
// builds never fetch from Google Fonts (that fetch made CI builds flaky) and members' browsers
// never call Google either. Free stand-ins for the brand book's paid fonts: Alegreya Sans for
// Elido (display, headings) and Source Sans 3 for Myriad (body).
export const alegreyaSans = localFont({
  src: [
    { path: "./fonts/alegreya-sans-500-latin.woff2", weight: "500", style: "normal" },
    { path: "./fonts/alegreya-sans-700-latin.woff2", weight: "700", style: "normal" },
    { path: "./fonts/alegreya-sans-800-latin.woff2", weight: "800", style: "normal" },
  ],
  variable: "--font-alegreya-sans",
  display: "swap",
});
export const sourceSans = localFont({
  src: [{ path: "./fonts/source-sans-3-latin.woff2", weight: "400 700", style: "normal" }],
  variable: "--font-source-sans",
  display: "swap",
});

export const fontVariables = [alegreyaSans, sourceSans].map((f) => f.variable).join(" ");
