import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env.local and run `npm run db:up` to start the local database.",
  );
}

// Reuse one connection pool across dev hot reloads instead of opening a new one each time.
const globalForDb = globalThis as unknown as { __hibitatSql?: ReturnType<typeof postgres> };
const sql = globalForDb.__hibitatSql ?? postgres(url, { max: 5 });
if (process.env.NODE_ENV !== "production") globalForDb.__hibitatSql = sql;

export const db = drizzle(sql, { schema });
export { schema };
