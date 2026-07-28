import { describe, expect, it } from "vitest";

import {
  calculateHaversineDistanceMeters,
  evaluateGpsVerification,
  type GpsVerificationInput,
} from "../src/index.js";

const receivedAt = new Date("2026-07-27T08:00:00.000Z");

const validInput: GpsVerificationInput = {
  target: { latitude: 37.5665, longitude: 126.978 },
  measured: { latitude: 37.56655, longitude: 126.97805 },
  accuracyM: 12,
  measuredAt: new Date("2026-07-27T07:59:50.000Z"),
  receivedAt,
  rule: {
    radiusM: 100,
    maximumAccuracyM: 50,
    maximumAgeMs: 60_000,
  },
};

describe("calculateHaversineDistanceMeters", () => {
  it("returns zero for identical coordinates", () => {
    expect(
      calculateHaversineDistanceMeters(validInput.target, validInput.target),
    ).toBe(0);
  });

  it("calculates a known approximate distance", () => {
    const distance = calculateHaversineDistanceMeters(
      { latitude: 37.5665, longitude: 126.978 },
      { latitude: 35.1796, longitude: 129.0756 },
    );

    expect(distance).toBeGreaterThan(320_000);
    expect(distance).toBeLessThan(330_000);
  });
});

describe("evaluateGpsVerification", () => {
  it("approves a recent and accurate position inside the radius", () => {
    const result = evaluateGpsVerification(validInput);

    expect(result.approved).toBe(true);
    expect(result.distanceM).toBeLessThan(100);
  });

  it("rejects an old measurement", () => {
    const result = evaluateGpsVerification({
      ...validInput,
      measuredAt: new Date("2026-07-27T07:58:00.000Z"),
    });

    expect(result).toEqual({ approved: false, code: "LOCATION_TOO_OLD" });
  });

  it("rejects poor accuracy", () => {
    const result = evaluateGpsVerification({ ...validInput, accuracyM: 80 });

    expect(result).toEqual({
      approved: false,
      code: "LOCATION_TOO_INACCURATE",
    });
  });

  it("rejects a position outside the allowed radius", () => {
    const result = evaluateGpsVerification({
      ...validInput,
      measured: { latitude: 37.57, longitude: 126.978 },
    });

    expect(result.approved).toBe(false);
    expect(result).toMatchObject({ code: "OUTSIDE_ALLOWED_RADIUS" });
  });
});
