import { describe, expect, it } from "vitest";

import {
  BOARD_CELL_COUNT,
  BINGO_LINE_COUNT,
  InvalidBoardPositionError,
  calculateBingoProgress,
  createBingoLines,
  findNewLineRewards,
  toBoardPosition,
} from "../src/index.js";

function positions(
  values: readonly number[],
): Set<ReturnType<typeof toBoardPosition>> {
  return new Set(values.map(toBoardPosition));
}

describe("createBingoLines", () => {
  it("creates five rows, five columns, and two diagonals", () => {
    const lines = createBingoLines();

    expect(lines).toHaveLength(BINGO_LINE_COUNT);
    expect(new Set(lines.map((line) => line.key))).toHaveLength(
      BINGO_LINE_COUNT,
    );
    expect(lines.every((line) => line.positions.length === 5)).toBe(true);
  });
});

describe("calculateBingoProgress", () => {
  it("does not clear with only two completed lines", () => {
    const progress = calculateBingoProgress(
      positions([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]),
    );

    expect(progress.completedLineCount).toBe(2);
    expect(progress.isClear).toBe(false);
  });

  it("clears when three distinct lines are completed", () => {
    const progress = calculateBingoProgress(
      positions([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]),
    );

    expect(progress.completedLineKeys).toEqual(["ROW_0", "ROW_1", "ROW_2"]);
    expect(progress.isClear).toBe(true);
    expect(progress.isPerfectClear).toBe(false);
  });

  it("counts every line completed by a shared cell", () => {
    const progress = calculateBingoProgress(
      positions([0, 1, 2, 3, 4, 6, 12, 18, 24]),
    );

    expect(progress.completedLineKeys).toEqual(["ROW_0", "DIAGONAL_MAIN"]);
  });

  it("marks a full board as perfect clear with all twelve lines", () => {
    const progress = calculateBingoProgress(
      positions(Array.from({ length: BOARD_CELL_COUNT }, (_, index) => index)),
    );

    expect(progress.completedLineCount).toBe(BINGO_LINE_COUNT);
    expect(progress.isClear).toBe(true);
    expect(progress.isPerfectClear).toBe(true);
  });
});

describe("toBoardPosition", () => {
  it.each([-1, 25, 1.5, Number.NaN])(
    "rejects invalid position %s",
    (position) => {
      expect(() => toBoardPosition(position)).toThrow(
        InvalidBoardPositionError,
      );
    },
  );
});

describe("findNewLineRewards", () => {
  it("returns only newly completed lines", () => {
    const progress = calculateBingoProgress(
      positions([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]),
    );

    expect(findNewLineRewards(progress, new Set(["ROW_0"]), 100)).toEqual([
      { lineKey: "ROW_1", points: 100 },
      { lineKey: "ROW_2", points: 100 },
    ]);
  });

  it("returns no rewards when every completed line was already rewarded", () => {
    const progress = calculateBingoProgress(positions([0, 1, 2, 3, 4]));

    expect(findNewLineRewards(progress, new Set(["ROW_0"]), 100)).toEqual([]);
  });

  it.each([-1, 1.5, Number.NaN])("rejects invalid points %s", (points) => {
    const progress = calculateBingoProgress(positions([]));

    expect(() => findNewLineRewards(progress, new Set(), points)).toThrow(
      RangeError,
    );
  });
});
