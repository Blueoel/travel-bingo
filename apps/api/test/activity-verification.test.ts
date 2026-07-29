import { describe, expect, it } from "vitest";

import { evaluateMission } from "../src/daily/mission-completion.service.js";

const now = new Date("2026-07-29T06:00:00.000Z");
const activity = {
  type: "ACTIVITY" as const,
  distanceM: 1_020,
  durationSeconds: 620,
  latitude: 37,
  longitude: 127,
  accuracyM: 12,
  measuredAt: now,
};

describe("activity mission verification", () => {
  it("approves a walking-distance mission only after the target", () => {
    const mission = {
      kind: "WALK_DISTANCE",
      targetValue: 1,
      targetUnit: "KILOMETER",
      verificationPolicy: {
        type: "GPS_DISTANCE",
        minimumKilometers: 1,
      },
    };

    expect(evaluateMission(mission, activity, now)).toMatchObject({
      approved: true,
      reasonCode: "GPS_DISTANCE_REACHED",
    });
    expect(
      evaluateMission(
        mission,
        { ...activity, distanceM: 990 },
        now,
      ),
    ).toMatchObject({
      approved: false,
      reasonCode: "GPS_DISTANCE_NOT_REACHED",
    });
  });

  it("approves duration and rejects excessive movement during a stay", () => {
    expect(
      evaluateMission(
        {
          kind: "COMPOSITE",
          targetValue: 600,
          targetUnit: "SECOND",
          verificationPolicy: { type: "GPS_DURATION", minimumSeconds: 600 },
        },
        activity,
        now,
      ),
    ).toMatchObject({
      approved: true,
      reasonCode: "GPS_DURATION_REACHED",
    });
    expect(
      evaluateMission(
        {
          kind: "COMPOSITE",
          targetValue: 600,
          targetUnit: "SECOND",
          verificationPolicy: {
            type: "GPS_STAY",
            durationSeconds: 600,
            allowedDriftM: 50,
          },
        },
        { ...activity, distanceM: 150 },
        now,
      ),
    ).toMatchObject({
      approved: false,
      reasonCode: "GPS_STAY_MOVED_TOO_FAR",
    });
  });
});
