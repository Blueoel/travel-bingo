import { describe, expect, it } from "vitest";

import { pointsForDifficulty } from "../src/mission.js";

describe("mission points", () => {
  it.each([
    ["EASY", 10],
    ["NORMAL", 20],
    ["HARD", 30],
    ["SPECIAL", 50],
  ] as const)("%s difficulty awards %i points", (difficulty, points) => {
    expect(pointsForDifficulty(difficulty)).toBe(points);
  });
});
