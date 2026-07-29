import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { DatabaseClient } from "@travel-bingo/database";
import {
  BOARD_CELL_COUNT,
  calculateBingoProgress,
  createDailyLayout,
  selectDailyLuckyPosition,
  selectDailyLayoutVariant,
  toBoardPosition,
  type BingoLineKey,
  type DailyLayoutIdentity,
} from "@travel-bingo/domain";

import { DATABASE_CLIENT } from "../database/database.module.js";
import { getDailyCycle, toDatabaseDate } from "./daily-date.js";

export interface CreateDailySessionCommand {
  readonly userId: string;
  readonly idempotencyKey: string;
  readonly now?: Date;
}

export interface GetDailySessionCommand {
  readonly userId: string;
  readonly now?: Date;
}

export interface DailySessionResult {
  readonly id: string;
  readonly date: string;
  readonly layoutVariant: number;
  readonly status: string;
  readonly totalPoints: number;
  readonly completedCellCount: number;
  readonly completedLineKeys: readonly BingoLineKey[];
  readonly cells: readonly {
    readonly id: string;
    readonly position: number;
    readonly status: string;
    readonly mission: unknown;
  }[];
}

@Injectable()
export class DailySessionService {
  constructor(
    @Inject(DATABASE_CLIENT) private readonly database: DatabaseClient,
  ) {}

  async getToday(command: GetDailySessionCommand): Promise<DailySessionResult> {
    const date = getDailyCycle(command.now ?? new Date()).date;
    const session = await this.database.bingoSession.findFirst({
      where: {
        userId: command.userId,
        dailyDate: toDatabaseDate(date),
      },
      orderBy: { startedAt: "desc" },
      include: {
        cells: { orderBy: { position: "asc" } },
      },
    });

    if (!session) {
      throw new NotFoundException(
        "Today's Daily bingo session does not exist.",
      );
    }

    return this.toResult(session, date);
  }

  async createOrGet(
    command: CreateDailySessionCommand,
  ): Promise<DailySessionResult> {
    const now = command.now ?? new Date();
    const date = getDailyCycle(now).date;
    const dailyDate = toDatabaseDate(date);

    const template = await this.database.bingoTemplate.findFirst({
      where: {
        type: "DAILY",
        status: "PUBLISHED",
        startsAt: { lte: now },
        OR: [{ endsAt: null }, { endsAt: { gt: now } }],
      },
      orderBy: [{ version: "desc" }, { publishedAt: "desc" }],
      include: {
        cells: {
          orderBy: { position: "asc" },
          include: {
            mission: {
              include: { place: true },
            },
          },
        },
      },
    });

    if (!template) {
      throw new NotFoundException("오늘 공개된 Daily 빙고가 없습니다.");
    }

    if (template.cells.length !== BOARD_CELL_COUNT) {
      throw new ConflictException(
        `Daily 빙고에는 ${BOARD_CELL_COUNT}개의 미션이 필요합니다.`,
      );
    }

    const existing = await this.database.bingoSession.findUnique({
      where: {
        userId_templateId_dailyDate: {
          userId: command.userId,
          templateId: template.id,
          dailyDate,
        },
      },
      include: {
        cells: { orderBy: { position: "asc" } },
      },
    });

    if (existing) {
      return this.toResult(existing, date);
    }

    const identity: DailyLayoutIdentity = {
      date,
      userId: command.userId,
      dailyVersion: template.version,
    };
    const layout = createDailyLayout(identity);
    const layoutVariant = selectDailyLayoutVariant(identity);
    const luckyPosition = selectDailyLuckyPosition(identity);
    const cellByCanonicalPosition = new Map(
      template.cells.map((cell) => [cell.position, cell]),
    );

    const session = await (async () => {
      try {
        return await this.database.bingoSession.create({
          data: {
            userId: command.userId,
            templateId: template.id,
            idempotencyKey: command.idempotencyKey,
            dailyDate,
            layoutVariant,
            totalPoints: luckyPosition === null ? 0 : 50,
            ...(luckyPosition === null
              ? {}
              : {
                  pointLedger: {
                    create: {
                      userId: command.userId,
                      referenceType: "DAILY_LUCKY",
                      referenceId: `${date}:${command.userId}`,
                      reason: "DAILY_LUCKY",
                      points: 50,
                    },
                  },
                }),
            cells: {
              create: layout.map((canonicalPosition, position) => {
                if (position === luckyPosition) {
                  return {
                    position,
                    status: "VERIFIED" as const,
                    verifiedAt: now,
                    missionSnapshot: {
                      id: `lucky:${date}:${command.userId}`,
                      kind: "CHECK_IN",
                      title: "Lucky!",
                      description:
                        "오늘도 좋은 하루가 되길 바라요. 행운의 칸은 무료로 완료됩니다.",
                      category: "LUCKY",
                      targetValue: null,
                      targetUnit: null,
                      radiusM: null,
                      points: 50,
                      difficulty: 0,
                      estimatedMinutesMin: null,
                      estimatedMinutesMax: null,
                      similarityGroup: "DAILY_LUCKY",
                      place: null,
                    },
                  };
                }
                const source = cellByCanonicalPosition.get(canonicalPosition);
                if (!source) {
                  throw new ConflictException(
                    `Daily 템플릿의 ${canonicalPosition}번 칸이 없습니다.`,
                  );
                }

                return {
                  position,
                  missionSnapshot: {
                    id: source.mission.id,
                    kind: source.mission.kind,
                    title: source.mission.title,
                    description: source.mission.description,
                    category: source.mission.category,
                    verificationPolicy: source.mission.verificationPolicy,
                    targetValue: source.mission.targetValue?.toString() ?? null,
                    targetUnit: source.mission.targetUnit,
                    radiusM: source.mission.radiusM,
                    points: source.mission.points,
                    difficulty: source.mission.difficulty,
                    estimatedMinutesMin: source.mission.estimatedMinutesMin,
                    estimatedMinutesMax: source.mission.estimatedMinutesMax,
                    similarityGroup: source.mission.similarityGroup,
                    place: source.mission.place
                      ? {
                          id: source.mission.place.id,
                          title: source.mission.place.title,
                          latitude: source.mission.place.latitude.toString(),
                          longitude: source.mission.place.longitude.toString(),
                        }
                      : null,
                  },
                };
              }),
            },
          },
          include: {
            cells: { orderBy: { position: "asc" } },
          },
        });
      } catch (error) {
        if (!isUniqueConstraintError(error)) throw error;
        const concurrentSession = await this.database.bingoSession.findUnique({
          where: {
            userId_templateId_dailyDate: {
              userId: command.userId,
              templateId: template.id,
              dailyDate,
            },
          },
          include: {
            cells: { orderBy: { position: "asc" } },
          },
        });
        if (!concurrentSession) throw error;
        return concurrentSession;
      }
    })();

    return this.toResult(session, date);
  }

  private toResult(
    session: {
      readonly id: string;
      readonly layoutVariant: number | null;
      readonly status: string;
      readonly totalPoints: number;
      readonly cells: readonly {
        readonly id: string;
        readonly position: number;
        readonly status: string;
        readonly missionSnapshot: unknown;
      }[];
    },
    date: string,
  ): DailySessionResult {
    if (session.layoutVariant === null) {
      throw new ConflictException("Daily 세션의 배치 정보가 없습니다.");
    }

    const progress = calculateBingoProgress(
      new Set(
        session.cells
          .filter((cell) => cell.status === "VERIFIED")
          .map((cell) => toBoardPosition(cell.position)),
      ),
    );

    return {
      id: session.id,
      date,
      layoutVariant: session.layoutVariant,
      status: session.status,
      totalPoints: session.totalPoints,
      completedCellCount: progress.completedCellCount,
      completedLineKeys: progress.completedLineKeys,
      cells: session.cells.map((cell) => ({
        id: cell.id,
        position: cell.position,
        status: cell.status,
        mission: toPublicMission(cell.missionSnapshot),
      })),
    };
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

function toPublicMission(snapshot: unknown): unknown {
  if (typeof snapshot !== "object" || snapshot === null) {
    return snapshot;
  }
  const { verificationPolicy: _privatePolicy, ...publicMission } =
    snapshot as Record<string, unknown>;
  return publicMission;
}
