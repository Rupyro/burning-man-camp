import type { MetadataRoute } from "next";
import { CAMP_NAME } from "@/lib/camp";
import { manifestBackground, manifestTheme } from "../../camp-art/colors";

/** Lets members add the app to their home screen; the Burn pack is the shortcut that works offline. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${CAMP_NAME} camp`,
    short_name: CAMP_NAME,
    start_url: "/",
    display: "standalone",
    background_color: manifestBackground,
    theme_color: manifestTheme,
    icons: [{ src: "/favicon.ico", sizes: "any", type: "image/x-icon" }],
    shortcuts: [{ name: "Burn pack", url: "/shifts/pack" }],
  };
}
