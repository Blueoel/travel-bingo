import { describe, expect, it } from "vitest";

import { getDailyCycle, getSeoulDate } from "../src/daily/daily-date.js";

describe("getSeoulDate", () => {
  it("uses Asia/Seoul midnight as the Daily boundary", () => {
    expect(getSeoulDate(new Date("2026-07-26T14:59:59.999Z"))).toBe(
      "2026-07-26",
    );
    expect(getSeoulDate(new Date("2026-07-26T15:00:00.000Z"))).toBe(
      "2026-07-27",
    );
  });
});

describe("getDailyCycle", () => {
  it("changes the Daily and ranking period at 00:30 Asia/Seoul", () => {
    expect(getDailyCycle(new Date("2026-07-26T15:29:59.999Z")).date).toBe(
      "2026-07-26",
    );
    const next = getDailyCycle(new Date("2026-07-26T15:30:00.000Z"));
    expect(next.date).toBe("2026-07-27");
    expect(next.startsAt.toISOString()).toBe("2026-07-26T15:30:00.000Z");
    expect(next.endsAt.toISOString()).toBe("2026-07-27T15:30:00.000Z");
  });
});
