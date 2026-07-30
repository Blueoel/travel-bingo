import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthService } from "../src/auth/auth.service.js";

const originalAdminApiKey = process.env.ADMIN_API_KEY;
const originalNodeEnv = process.env.NODE_ENV;

afterEach(() => {
  if (originalAdminApiKey === undefined) delete process.env.ADMIN_API_KEY;
  else process.env.ADMIN_API_KEY = originalAdminApiKey;
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;
});

describe("admin API key authentication", () => {
  it("resolves an active administrator for a valid server-side key", async () => {
    process.env.NODE_ENV = "production";
    process.env.ADMIN_API_KEY = "test-admin-secret";
    const database = {
      user: {
        findFirst: vi.fn().mockResolvedValue({ id: "admin-id" }),
      },
    };
    const service = new AuthService(database as never);

    await expect(
      service.requireAdminId(undefined, "test-admin-secret"),
    ).resolves.toBe("admin-id");
    expect(database.user.findFirst).toHaveBeenCalledWith({
      where: { role: "ADMIN", status: "ACTIVE" },
      select: { id: true },
    });
  });

  it("rejects an invalid server-side key in production", async () => {
    process.env.NODE_ENV = "production";
    process.env.ADMIN_API_KEY = "test-admin-secret";
    const service = new AuthService({} as never);

    await expect(
      service.requireAdminId(undefined, "wrong-secret"),
    ).rejects.toThrow("valid administrator session");
  });
});
