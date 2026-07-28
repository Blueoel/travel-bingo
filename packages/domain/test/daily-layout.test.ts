import { describe, expect, it } from "vitest";

import {
  BOARD_CELL_COUNT,
  createBingoLines,
  createDailyLayout,
  selectDailyLayoutVariant,
  toBoardPosition,
  transformBoardPosition,
  type DailyLayoutVariant,
} from "../src/index.js";

const identity = {
  date: "2026-07-27",
  userId: "user-123",
  dailyVersion: 1,
} as const;

function normalizedLine(positions: readonly number[]): string {
  return [...positions].sort((left, right) => left - right).join(",");
}

describe("daily layout", () => {
  it("returns the same variant for the same identity", () => {
    expect(selectDailyLayoutVariant(identity)).toBe(
      selectDailyLayoutVariant(identity),
    );
  });

  it("can vary between users", () => {
    const variants = new Set(
      Array.from({ length: 20 }, (_, index) =>
        selectDailyLayoutVariant({ ...identity, userId: `user-${index}` }),
      ),
    );

    expect(variants.size).toBeGreaterThan(1);
  });

  it("contains every canonical mission exactly once", () => {
    const layout = createDailyLayout(identity);

    expect(layout).toHaveLength(BOARD_CELL_COUNT);
    expect(new Set(layout).size).toBe(BOARD_CELL_COUNT);
    expect([...layout].sort((left, right) => left - right)).toEqual(
      Array.from({ length: BOARD_CELL_COUNT }, (_, index) => index),
    );
  });

  it.each(Array.from({ length: 8 }, (_, index) => index as DailyLayoutVariant))(
    "variant %s preserves all bingo lines",
    (variant) => {
      const canonicalLines = new Set(
        createBingoLines().map((line) => normalizedLine(line.positions)),
      );
      const transformedLines = new Set(
        createBingoLines().map((line) =>
          normalizedLine(
            line.positions.map((position) =>
              transformBoardPosition(toBoardPosition(position), variant),
            ),
          ),
        ),
      );

      expect(transformedLines).toEqual(canonicalLines);
    },
  );
});
