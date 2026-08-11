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
    const token = service.issue(missionId);
    expect(service.verifies(token, missionId)).toBe(true);
    expect(
      service.verifies(token, "10000000-0000-4000-8000-000000000100"),
    ).toBe(false);
  });

  it("rejects a modified token", () => {
    const token = service.issue(missionId);
    expect(service.verifies(`${token.slice(0, -1)}x`, missionId)).toBe(false);
  });

  it("completes a QR mission only after signature verification", () => {
    const mission = {
      id: missionId,
      kind: "QR_SCAN",
      verificationPolicy: { type: "QR_SCAN" },
    };
    const token = service.issue(missionId);
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
});
