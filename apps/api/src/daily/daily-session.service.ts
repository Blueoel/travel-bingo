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
  const { verificationPolicy, ...publicMission } = snapshot as Record<
    string,
    unknown
  >;
  const policy =
    typeof verificationPolicy === "object" && verificationPolicy !== null
      ? (verificationPolicy as Record<string, unknown>)
      : null;
  const interactionType =
    policy?.type === "TEXT"
      ? "TEXT"
      : policy?.type === "TIMER"
        ? "TIMER"
        : undefined;
  const policyCompositeRequirements =
    policy?.type === "COMPOSITE" && Array.isArray(policy.requirements)
      ? policy.requirements
          .filter((item): item is Record<string, unknown> =>
            typeof item === "object" && item !== null,
          )
          .map((item) => ({
            type: String(item.type ?? ""),
            count:
              typeof item.count === "number" ? Math.max(1, item.count) : 1,
            maxLength:
              typeof item.maxLength === "number" ? item.maxLength : undefined,
            role: typeof item.role === "string" ? item.role : undefined,
            options: Array.isArray(item.options)
              ? item.options.filter((option): option is string => typeof option === "string")
              : undefined,
          }))
      : undefined;
  const compositeRequirements =
    YEONCHEON_COMPOSITE_REQUIREMENTS[String(publicMission.title ?? "")] ??
    policyCompositeRequirements;
  const quizChoices =
    policy?.type === "QUIZ"
      ? toQuizChoices(policy.choices) ??
        LEGACY_QUIZ_CHOICES[String(publicMission.title ?? "")]
      : undefined;
  return {
    ...publicMission,
    ...(interactionType ? { interactionType } : {}),
    ...(interactionType === "TIMER" &&
    typeof policy?.durationSeconds === "number"
      ? { timerSeconds: policy.durationSeconds }
      : {}),
    ...(interactionType === "TEXT" && typeof policy?.maxLength === "number"
      ? { textMaxLength: policy.maxLength }
      : {}),
    ...(compositeRequirements
      ? { compositeRequirements }
      : {}),
    ...(quizChoices?.length ? { quizChoices } : {}),
  };
}

const LEGACY_QUIZ_CHOICES: Record<string, string[]> = {
  "주먹 속의 돌": [
    "①뼈바늘",
    "②주먹도끼",
    "③빗살무늬토기",
    "④가락바퀴",
  ],
  "신라의 마침표": [
    "①46대",
    "②49대",
    "③54대",
    "④56대",
  ],
  "급수탑 키재기": ["①12m", "②18m", "③23m", "④31m"],
  "왜 베개일까?": [
    "①색이 하얘서",
    "②베개처럼 둥근 형태",
    "③부드러워서",
    "④밤에 형성돼서",
  ],
  "다시 세운 교육": [
    "①1955년",
    "②1965년",
    "③1977년",
    "④1981년",
  ],
};

const YEONCHEON_COMPOSITE_REQUIREMENTS: Record<
  string,
  Array<{ type: string; count: number; maxLength?: number; role?: string; options?: string[] }>
> = {
  "오늘의 연천": [
    { type: "PHOTO", count: 1 },
    { type: "TEXT", count: 1, maxLength: 100 },
  ],
  "오늘의 연천색": [
    {
      type: "TEXT",
      count: 1,
      maxLength: 140,
      role: "COLOR_NOTE",
      options: ["빨강", "주황", "노랑", "초록", "파랑", "보라", "분홍", "갈색", "회색", "흰색", "검정"],
    },
  ],
};

function toQuizChoices(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    const choices = value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
    return choices.length >= 2 ? choices : undefined;
  }
  if (typeof value !== "string") return undefined;
  const choices = value
    .split(/(?=[①②③④⑤⑥⑦⑧⑨⑩])/u)
    .map((item) => item.trim())
    .filter(Boolean);
  return choices.length >= 2 ? choices : undefined;
}
