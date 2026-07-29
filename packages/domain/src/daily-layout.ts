import {
  BOARD_CELL_COUNT,
  BOARD_SIZE,
  toBoardPosition,
  type BoardPosition,
} from "./bingo.js";

export const DAILY_LAYOUT_VARIANT_COUNT = 8;
export const DAILY_LUCKY_CHANCE_PERCENT = 20;

export type DailyLayoutVariant = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface DailyLayoutIdentity {
  readonly date: string;
  readonly userId: string;
  readonly dailyVersion: number;
}

function hashIdentity(identity: DailyLayoutIdentity, salt = ""): number {
  const input = `${identity.date}:${identity.userId}:${identity.dailyVersion}:${salt}`;
  let hash = 2_166_136_261;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }

  return hash >>> 0;
}

export function selectDailyLayoutVariant(
  identity: DailyLayoutIdentity,
): DailyLayoutVariant {
  return (hashIdentity(identity) %
    DAILY_LAYOUT_VARIANT_COUNT) as DailyLayoutVariant;
}

export function selectDailyLuckyPosition(
  identity: DailyLayoutIdentity,
): BoardPosition | null {
  const luckyHash = hashIdentity(identity, "lucky");
  if (luckyHash % 100 >= DAILY_LUCKY_CHANCE_PERCENT) return null;

  return toBoardPosition(
    hashIdentity(identity, "lucky-position") % BOARD_CELL_COUNT,
  );
}

function rotateClockwise(
  row: number,
  column: number,
): readonly [number, number] {
  return [column, BOARD_SIZE - 1 - row];
}

function transformCoordinates(
  row: number,
  column: number,
  variant: DailyLayoutVariant,
): readonly [number, number] {
  const shouldReflect = variant >= 4;
  const rotations = variant % 4;
  let transformedRow = row;
  let transformedColumn = shouldReflect ? BOARD_SIZE - 1 - column : column;

  for (let index = 0; index < rotations; index += 1) {
    [transformedRow, transformedColumn] = rotateClockwise(
      transformedRow,
      transformedColumn,
    );
  }

  return [transformedRow, transformedColumn];
}

export function transformBoardPosition(
  position: BoardPosition,
  variant: DailyLayoutVariant,
): BoardPosition {
  const row = Math.floor(position / BOARD_SIZE);
  const column = position % BOARD_SIZE;
  const [transformedRow, transformedColumn] = transformCoordinates(
    row,
    column,
    variant,
  );

  return toBoardPosition(transformedRow * BOARD_SIZE + transformedColumn);
}

export function createDailyLayout(
  identity: DailyLayoutIdentity,
): readonly BoardPosition[] {
  const variant = selectDailyLayoutVariant(identity);
  const layout = new Array<BoardPosition>(BOARD_CELL_COUNT);

  for (
    let canonicalPosition = 0;
    canonicalPosition < BOARD_CELL_COUNT;
    canonicalPosition += 1
  ) {
    const source = toBoardPosition(canonicalPosition);
    const target = transformBoardPosition(source, variant);
    layout[target] = source;
  }

  return layout;
}
