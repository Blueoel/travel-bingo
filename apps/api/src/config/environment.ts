import { resolve } from "node:path";

import { config as loadEnvironment } from "dotenv";

loadEnvironment({
  path: resolve(import.meta.dirname, "../../../../.env"),
  quiet: true,
});

export interface ApiEnvironment {
  readonly databaseUrl: string;
  readonly port: number;
  readonly corsOrigins: string[];
}

export function readApiEnvironment(): ApiEnvironment {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  const port = Number(process.env.API_PORT ?? 4000);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`API_PORT must be a valid port: ${process.env.API_PORT}`);
  }

  const corsOrigins = (process.env.CORS_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (process.env.NODE_ENV === "production" && corsOrigins.length === 0) {
    throw new Error("CORS_ORIGINS is required in production");
  }

  return { databaseUrl, port, corsOrigins };
}
