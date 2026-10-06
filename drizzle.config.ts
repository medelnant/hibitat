import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";

// Same env loading as Next.js, so .env.local works for migrations too.
loadEnvConfig(process.cwd());

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
