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
  selectPersonalizedDailyMissions,
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
    });

    if (!template) {
      throw new NotFoundException("오늘 공개된 Daily 빙고가 없습니다.");
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

    const collection = await this.database.missionCollection.findFirst({
      where: { type: "DAILY", regionId: null, status: "ACTIVE" },
      include: {
        items: {
          where: {
            mission: {
              scope: "COMMON",
              status: "ACTIVE",
              difficulty: { in: [1, 2, 3] },
            },
          },
          include: {
            mission: {
              include: { place: true },
            },
          },
        },
      },
    });
    if (!collection || collection.items.length < BOARD_CELL_COUNT) {
      throw new ConflictException(
        `Daily 후보에는 활성 공통 미션이 ${BOARD_CELL_COUNT}개 이상 필요합니다.`,
      );
    }

    const identity: DailyLayoutIdentity = {
      date,
      userId: command.userId,
      dailyVersion: template.version,
    };
    const layout = createDailyLayout(identity);
    const layoutVariant = selectDailyLayoutVariant(identity);
    const luckyPosition = selectDailyLuckyPosition(identity);
    const selectedMissions = selectPersonalizedDailyMissions(
      identity,
      collection.items.map((item) => item.mission),
    );
    if (selectedMissions.length !== BOARD_CELL_COUNT) {
      throw new ConflictException(
        `Daily 미션 ${BOARD_CELL_COUNT}개를 구성할 수 없습니다.`,
      );
    }

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
                const source = selectedMissions[canonicalPosition];
                if (!source) {
                  throw new ConflictException(
                    `Daily 선택 결과의 ${canonicalPosition}번 칸이 없습니다.`,
                  );
                }

                return {
                  position,
                  missionSnapshot: {
                    id: source.id,
                    kind: source.kind,
                    title: source.title,
                    description: source.description,
                    category: source.category,
                    verificationPolicy: source.verificationPolicy,
                    targetValue: source.targetValue?.toString() ?? null,
                    targetUnit: source.targetUnit,
                    radiusM: source.radiusM,
                    points: source.points,
                    difficulty: source.difficulty,
                    estimatedMinutesMin: source.estimatedMinutesMin,
                    estimatedMinutesMax: source.estimatedMinutesMax,
                    similarityGroup: source.similarityGroup,
                    place: source.place
                      ? {
                          id: source.place.id,
                          title: source.place.title,
                          latitude: source.place.latitude.toString(),
                          longitude: source.place.longitude.toString(),
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
