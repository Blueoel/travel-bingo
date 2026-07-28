import { afterEach, describe, expect, it } from "vitest";

import { readApiEnvironment } from "../src/config/environment.js";

const originalNodeEnv = process.env.NODE_ENV;
const originalDatabaseUrl = process.env.DATABASE_URL;
const originalApiPort = process.env.API_PORT;
const originalCorsOrigins = process.env.CORS_ORIGINS;

afterEach(() => {
  restore("NODE_ENV", originalNodeEnv);
  restore("DATABASE_URL", originalDatabaseUrl);
  restore("API_PORT", originalApiPort);
  restore("CORS_ORIGINS", originalCorsOrigins);
});

describe("API environment", () => {
  it("parses comma-separated CORS origins", () => {
    process.env.NODE_ENV = "production";
    process.env.DATABASE_URL = "postgresql://example.invalid/travel_bingo";
    process.env.API_PORT = "4000";
    process.env.CORS_ORIGINS = "https://app.example, https://admin.example ";

    expect(readApiEnvironment()).toEqual({
      databaseUrl: "postgresql://example.invalid/travel_bingo",
      port: 4000,
      corsOrigins: ["https://app.example", "https://admin.example"],
    });
  });

  it("requires an explicit CORS origin in production", () => {
    process.env.NODE_ENV = "production";
    process.env.DATABASE_URL = "postgresql://example.invalid/travel_bingo";
    delete process.env.CORS_ORIGINS;

    expect(() => readApiEnvironment()).toThrow(
      "CORS_ORIGINS is required in production",
    );
  });
});

function restore(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}
