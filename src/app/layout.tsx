import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { themeBootScript } from "@/lib/theme-mode";
import { chromeThemeColor } from "../../camp-art/colors";
import { fontVariables } from "../../camp-art/fonts";
import { Backdrop } from "./_components/backdrop";
import "./globals.css";
import { CAMP_NAME } from "@/lib/camp";

export const metadata: Metadata = {
  title: `${CAMP_NAME} camp ops`,
  description: `Operations platform for the ${CAMP_NAME} camp at AfrikaBurn`,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: chromeThemeColor,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`h-full antialiased font-sans ${fontVariables}`}
      suppressHydrationWarning
    >
      <head>
        {/* Sets day or night before first paint (sunrise/sunset at Tankwa, or the saved choice). */}
        <Script id="theme-boot" strategy="beforeInteractive">
          {themeBootScript()}
        </Script>
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <Backdrop />
        {children}
      </body>
    </html>
  );
}
