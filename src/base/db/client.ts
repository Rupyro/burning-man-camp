import "server-only";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getEnv } from "@/lib/env";
import { globalSingleton } from "@/lib/global-singleton";
import { noop } from "@/lib/noop";
import * as schema from "../schema";

export type BaseSchema = typeof schema;
export type Db = PostgresJsDatabase<BaseSchema>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
/** Either the root handle or a transaction: the base APIs accept both. */
export type DbOrTx = Db | Tx;

type Holder = { db?: Db; client?: ReturnType<typeof postgres>; url?: string };
// globalThis keeps one pool across Next.js dev reloads and separate server bundles.
const holder: Holder = globalSingleton<Holder>("__campDb", () => ({}));

/**
 * The shared Postgres handle. DATABASE_URL is a plain Postgres URL, so local
 * Postgres, Docker and Neon (pooled URL) all work without code changes.
 */
export function getDb(): Db {
  const url = getEnv().DATABASE_URL;
  if (holder.db && holder.url === url) return holder.db;
  holder.client = postgres(url, { max: 5, onnotice: noop });
  holder.db = drizzle(holder.client, { schema });
  holder.url = url;
  return holder.db;
}

export async function closeDb(): Promise<void> {
  await holder.client?.end({ timeout: 5 });
  holder.db = undefined;
  holder.client = undefined;
  holder.url = undefined;
}
