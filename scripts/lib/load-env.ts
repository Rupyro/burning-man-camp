import { config } from "dotenv";

/** Same precedence as Next.js for local scripts: .env.local, then .env. Real env vars win. */
export function loadEnv() {
  config({ path: [".env.local", ".env"], quiet: true });
}
