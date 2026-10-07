import { defineConfig } from "prisma/config";
import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";

// Prisma config files do not auto-load .env. Vercel supplies DATABASE_URL
// directly, while local development reads it from this repository's .env.
if (existsSync(".env")) {
  loadEnvFile(".env");
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
