import { resolve } from "node:path";

import { config as loadEnvironment } from "dotenv";
import { defineConfig, env } from "prisma/config";

loadEnvironment({
  path: resolve(import.meta.dirname, "../../.env"),
  quiet: true,
});

const seedPath = resolve(import.meta.dirname, "prisma/seed.ts");

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: process.platform === "win32" ? `tsx "${seedPath}"` : `tsx ${seedPath}`,
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
