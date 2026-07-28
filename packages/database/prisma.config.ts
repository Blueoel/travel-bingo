import { resolve } from "node:path";

import { config as loadEnvironment } from "dotenv";
import { defineConfig, env } from "prisma/config";

loadEnvironment({
  path: resolve(import.meta.dirname, "../../.env"),
  quiet: true,
});

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
