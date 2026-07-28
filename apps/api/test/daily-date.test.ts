import { describe, expect, it } from "vitest";

import { getSeoulDate } from "../src/daily/daily-date.js";

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
