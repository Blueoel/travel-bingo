export const BOARD_SIZE = 5;
export const BOARD_CELL_COUNT = BOARD_SIZE * BOARD_SIZE;
export const BINGO_LINE_COUNT = BOARD_SIZE * 2 + 2;
export const CLEAR_LINE_COUNT = 3;

declare const boardPositionBrand: unique symbol;

export type BoardPosition = number & {
  readonly [boardPositionBrand]: "BoardPosition";
};

export type BingoLineKey =
  | `ROW_${0 | 1 | 2 | 3 | 4}`
  | `COLUMN_${0 | 1 | 2 | 3 | 4}`
  | "DIAGONAL_MAIN"
  | "DIAGONAL_ANTI";

export interface BingoLine {
  readonly key: BingoLineKey;
  readonly positions: readonly BoardPosition[];
}

export interface BingoProgress {
  readonly completedCellCount: number;
  readonly completedLineKeys: readonly BingoLineKey[];
  readonly completedLineCount: number;
  readonly isClear: boolean;
  readonly isPerfectClear: boolean;
}

export interface NewLineReward {
  readonly lineKey: BingoLineKey;
  readonly points: number;
}

export class InvalidBoardPositionError extends RangeError {
  constructor(position: number) {
    super(
      `Board position must be an integer from 0 to ${BOARD_CELL_COUNT - 1}: ${position}`,
    );
    this.name = "InvalidBoardPositionError";
  }
}

export function toBoardPosition(position: number): BoardPosition {
  if (
    !Number.isInteger(position) ||
    position < 0 ||
    position >= BOARD_CELL_COUNT
  ) {
    throw new InvalidBoardPositionError(position);
  }

  return position as BoardPosition;
}

function createRow(row: number): BoardPosition[] {
  return Array.from({ length: BOARD_SIZE }, (_, column) =>
    toBoardPosition(row * BOARD_SIZE + column),
  );
}

function createColumn(column: number): BoardPosition[] {
  return Array.from({ length: BOARD_SIZE }, (_, row) =>
    toBoardPosition(row * BOARD_SIZE + column),
  );
}

export function createBingoLines(): readonly BingoLine[] {
  const rows = Array.from({ length: BOARD_SIZE }, (_, index) => ({
    key: `ROW_${index}` as BingoLineKey,
    positions: createRow(index),
  }));

  const columns = Array.from({ length: BOARD_SIZE }, (_, index) => ({
    key: `COLUMN_${index}` as BingoLineKey,
    positions: createColumn(index),
  }));

  const diagonals: BingoLine[] = [
    {
      key: "DIAGONAL_MAIN",
      positions: Array.from({ length: BOARD_SIZE }, (_, index) =>
        toBoardPosition(index * BOARD_SIZE + index),
      ),
    },
    {
      key: "DIAGONAL_ANTI",
      positions: Array.from({ length: BOARD_SIZE }, (_, index) =>
        toBoardPosition(index * BOARD_SIZE + (BOARD_SIZE - 1 - index)),
      ),
    },
  ];

  return [...rows, ...columns, ...diagonals];
}

const BINGO_LINES = createBingoLines();

export function calculateBingoProgress(
  completedPositions: ReadonlySet<BoardPosition>,
): BingoProgress {
  const completedLineKeys = BINGO_LINES.filter((line) =>
    line.positions.every((position) => completedPositions.has(position)),
  ).map((line) => line.key);

  return {
    completedCellCount: completedPositions.size,
    completedLineKeys,
    completedLineCount: completedLineKeys.length,
    isClear: completedLineKeys.length >= CLEAR_LINE_COUNT,
    isPerfectClear: completedPositions.size === BOARD_CELL_COUNT,
  };
}

export function findNewLineRewards(
  progress: BingoProgress,
  alreadyRewardedLineKeys: ReadonlySet<BingoLineKey>,
  pointsPerLine: number,
): readonly NewLineReward[] {
  if (!Number.isInteger(pointsPerLine) || pointsPerLine < 0) {
    throw new RangeError(
      `Points per line must be a non-negative integer: ${pointsPerLine}`,
    );
  }

  return progress.completedLineKeys
    .filter((lineKey) => !alreadyRewardedLineKeys.has(lineKey))
    .map((lineKey) => ({ lineKey, points: pointsPerLine }));
}
