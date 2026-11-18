import type { NextConfig } from "next";

// Cache Components / partial prefetching are switched off on purpose for now:
// every app page reads the session and runs the server-side guard, so it is
// request-time anyway. See docs/adr/0001-stack.md.
const nextConfig: NextConfig = {
  typedRoutes: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
