import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { evaluateMission } from "../src/daily/mission-completion.service.js";
import { MissionQrService } from "../src/qr/mission-qr.service.js";

describe("signed QR mission verification", () => {
  const missionId = "10000000-0000-4000-8000-000000000099";
  const service = new MissionQrService();

  beforeEach(() => {
    process.env.QR_SIGNING_SECRET = "test-only-qr-secret";
  });

  afterEach(() => {
    delete process.env.QR_SIGNING_SECRET;
  });

  it("accepts the issued token only for its own mission", () => {
    const token = service.issue(missionId).token;
    expect(service.verifies(token, missionId)).toBe(true);
    expect(
      service.verifies(token, "10000000-0000-4000-8000-000000000100"),
    ).toBe(false);
  });

  it("rejects a modified token", () => {
    const token = service.issue(missionId).token;
    expect(service.verifies(`${token.slice(0, -1)}x`, missionId)).toBe(false);
  });

  it("expires a token after its configured validity window", () => {
    const issuedAt = new Date("2026-08-11T00:00:00.000Z");
    const issued = service.issue(missionId, 1, issuedAt);
    expect(
      service.verifies(
        issued.token,
        missionId,
        new Date("2026-08-11T00:59:59.000Z"),
      ),
    ).toBe(true);
    expect(
      service.inspect(
        issued.token,
        missionId,
        new Date("2026-08-11T01:00:00.000Z"),
      ),
    ).toEqual({ valid: false, reason: "EXPIRED" });
  });

  it("creates a different signed token when reissued", () => {
    const first = service.issue(missionId, 24);
    const second = service.issue(missionId, 24);
    expect(second.token).not.toBe(first.token);
    expect(service.verifies(first.token, missionId)).toBe(true);
    expect(service.verifies(second.token, missionId)).toBe(true);
  });

  it("completes a QR mission only after signature verification", () => {
    const mission = {
      id: missionId,
      kind: "QR_SCAN",
      verificationPolicy: { type: "QR_SCAN" },
    };
    const token = service.issue(missionId).token;
    expect(
      evaluateMission(
        mission,
        { type: "QR", token },
        new Date(),
        service,
      ),
    ).toEqual({ approved: true, reasonCode: "QR_VERIFIED" });
    expect(
      evaluateMission(
        mission,
        { type: "QR", token: `${token}broken` },
        new Date(),
        service,
      ),
    ).toEqual({ approved: false, reasonCode: "QR_INVALID" });
  });

  it("reports an expired QR mission separately", () => {
    const mission = {
      id: missionId,
      kind: "QR_SCAN",
      verificationPolicy: { type: "QR_SCAN" },
    };
    const token = service.issue(
      missionId,
      1,
      new Date("2026-08-11T00:00:00.000Z"),
    ).token;
    expect(
      evaluateMission(
        mission,
        { type: "QR", token },
        new Date("2026-08-11T01:00:00.000Z"),
        service,
      ),
    ).toEqual({ approved: false, reasonCode: "QR_EXPIRED" });
  });
});
