import type { MetadataRoute } from "next";
import { manifestBackground, manifestTheme } from "../../camp-art/colors";

/** Lets members add the app to their home screen; the Burn pack is the shortcut that works offline. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Oe·aa·sieS camp",
    short_name: "Oe·aa·sieS",
    start_url: "/",
    display: "standalone",
    background_color: manifestBackground,
    theme_color: manifestTheme,
    icons: [{ src: "/favicon.ico", sizes: "any", type: "image/x-icon" }],
    shortcuts: [{ name: "Burn pack", url: "/shifts/pack" }],
  };
}
