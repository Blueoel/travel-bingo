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
  selectPersonalizedDailyMissions,
  toBoardPosition,
  type BingoLineKey,
  type DailyLayoutIdentity,
} from "@travel-bingo/domain";

import { DATABASE_CLIENT } from "../database/database.module.js";
import { getDailyCycle, toDatabaseDate } from "../daily/daily-date.js";

export type BingoCatalogType = "DAILY" | "REGION" | "EVENT";
export type BingoCatalogState = "IN_PROGRESS" | "COMPLETED" | "AVAILABLE";

export interface BingoCatalogItem {
  readonly id: string;
  readonly templateId: string;
  readonly sessionId: string | null;
  readonly type: BingoCatalogType;
  readonly title: string;
  readonly regionName: string | null;
  readonly regionCode: string | null;
  readonly state: BingoCatalogState;
  readonly completedCellCount: number;
  readonly totalCellCount: number;
  readonly totalPoints: number;
  readonly startsAt: string | null;
  readonly endsAt: string | null;
}

export interface BingoBoardResult {
  readonly id: string;
  readonly templateId: string;
  readonly type: BingoCatalogType;
  readonly title: string;
  readonly regionName: string;
  readonly regionCode: string;
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
export class BingoCatalogService {
  constructor(
    @Inject(DATABASE_CLIENT) private readonly database: DatabaseClient,
  ) {}

  async list(userId: string, now = new Date()): Promise<BingoCatalogItem[]> {
    const currentDailyDate = toDatabaseDate(getDailyCycle(now).date);
    const [sessions, availableTemplates] = await Promise.all([
      this.database.bingoSession.findMany({
        where: {
          userId,
          OR: [
            { template: { type: { not: "DAILY" } } },
            {
              template: { type: "DAILY" },
              dailyDate: currentDailyDate,
            },
          ],
        },
        include: {
          template: { include: { region: true } },
          cells: { select: { status: true } },
        },
        orderBy: { updatedAt: "desc" },
      }),
      this.database.bingoTemplate.findMany({
        where: {
          status: "PUBLISHED",
          region: { status: "ACTIVE" },
          type: { in: ["REGION", "EVENT"] },
          AND: [
            { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
            { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
          ],
        },
        include: {
          region: true,
          _count: { select: { cells: true } },
        },
        orderBy: [{ type: "asc" }, { publishedAt: "desc" }],
      }),
    ]);

    const sessionTemplateIds = new Set(
      sessions.map((session) => session.templateId),
    );
    const sessionItems = sessions.map((session) => {
      const completedCellCount = session.cells.filter(
        (cell) => cell.status === "VERIFIED",
      ).length;
      return {
        id: `session:${session.id}`,
        templateId: session.templateId,
        sessionId: session.id,
        type: normalizeType(session.template.type),
        title: session.template.title,
        regionName:
          normalizeType(session.template.type) === "DAILY"
            ? null
            : session.template.region.name,
        regionCode:
          normalizeType(session.template.type) === "DAILY"
            ? null
            : session.template.region.administrativeCode,
        state: isCompleted(session.status) ? "COMPLETED" : "IN_PROGRESS",
        completedCellCount,
        totalCellCount: session.cells.length,
        totalPoints: session.totalPoints,
        startsAt: toIso(session.template.startsAt),
        endsAt: toIso(session.template.endsAt),
      } satisfies BingoCatalogItem;
    });
    const availableItems = availableTemplates
      .filter((template) => !sessionTemplateIds.has(template.id))
      .map(
        (template) =>
          ({
            id: `template:${template.id}`,
            templateId: template.id,
            sessionId: null,
            type: normalizeType(template.type),
            title: template.title,
            regionName: template.region.name,
            regionCode: template.region.administrativeCode,
            state: "AVAILABLE",
            completedCellCount: 0,
            totalCellCount: template._count.cells,
            totalPoints: 0,
            startsAt: toIso(template.startsAt),
            endsAt: toIso(template.endsAt),
          }) satisfies BingoCatalogItem,
      );

    return [...sessionItems, ...availableItems].sort(compareCatalogItems);
  }

  async getSession(userId: string, sessionId: string): Promise<BingoBoardResult> {
    const session = await this.database.bingoSession.findFirst({
      where: { id: sessionId, userId },
      include: boardSessionInclude,
    });
    if (!session) throw new NotFoundException("빙고 진행 기록을 찾을 수 없습니다.");
    return toBoardResult(session);
  }

  async createOrGetSession(input: {
    readonly userId: string;
    readonly templateId: string;
    readonly idempotencyKey: string;
    readonly now?: Date;
  }): Promise<BingoBoardResult> {
    const now = input.now ?? new Date();
    const existing = await this.database.bingoSession.findFirst({
      where: { userId: input.userId, templateId: input.templateId },
      include: boardSessionInclude,
      orderBy: { updatedAt: "desc" },
    });
    if (existing) return toBoardResult(existing);

    const template = await this.database.bingoTemplate.findFirst({
      where: {
        id: input.templateId,
        status: "PUBLISHED",
        region: { status: "ACTIVE" },
        type: { in: ["REGION", "EVENT"] },
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
        ],
      },
      include: {
        region: {
          include: {
            missionLinks: {
              where: {
                mission: {
                  scope: "REGION",
                  status: "ACTIVE",
                  difficulty: { in: [1, 2, 3] },
                },
              },
              include: { mission: { include: { place: true } } },
            },
          },
        },
        cells: {
          include: { mission: { include: { place: true } } },
          orderBy: { position: "asc" },
        },
      },
    });
    if (!template) {
      throw new NotFoundException("현재 시작할 수 있는 빙고가 아닙니다.");
    }
    if (template.cells.length !== BOARD_CELL_COUNT) {
      throw new ConflictException(
        `공개 빙고판에는 미션 ${BOARD_CELL_COUNT}개가 필요합니다.`,
      );
    }

    const identity: DailyLayoutIdentity = {
      date: `region:${template.id}`,
      userId: input.userId,
      dailyVersion: template.version,
    };
    const regionalCandidates = template.region.missionLinks.map(
      (link) => link.mission,
    );
    const sessionMissions =
      normalizeType(template.type) === "REGION"
        ? selectPersonalizedDailyMissions(identity, regionalCandidates)
        : template.cells.map((cell) => cell.mission);
    if (sessionMissions.length !== BOARD_CELL_COUNT) {
      throw new ConflictException(
        `지역 빙고 후보에는 활성 미션 ${BOARD_CELL_COUNT}개 이상이 필요합니다.`,
      );
    }
    const layout =
      normalizeType(template.type) === "REGION"
        ? createDailyLayout(identity)
        : Array.from({ length: BOARD_CELL_COUNT }, (_, index) => index);

    try {
      const session = await this.database.bingoSession.create({
        data: {
          userId: input.userId,
          templateId: template.id,
          idempotencyKey: input.idempotencyKey,
          dailyDate: null,
          layoutVariant: null,
          cells: {
            create: layout.map((sourcePosition, position) => ({
              position,
              missionSnapshot: missionSnapshot(
                sessionMissions[sourcePosition]!,
              ) as never,
            })),
          },
        },
      });
      const created = await this.database.bingoSession.findFirst({
        where: { id: session.id, userId: input.userId },
        include: boardSessionInclude,
      });
      if (!created) {
        throw new NotFoundException("생성된 빙고 진행 기록을 찾을 수 없습니다.");
      }
      return toBoardResult(created);
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
      const concurrent = await this.database.bingoSession.findFirst({
        where: { userId: input.userId, templateId: input.templateId },
        include: boardSessionInclude,
        orderBy: { updatedAt: "desc" },
      });
      if (!concurrent) throw error;
      return toBoardResult(concurrent);
    }
  }
}

const boardSessionInclude = {
  template: { include: { region: true } },
  cells: { orderBy: { position: "asc" as const } },
} as const;

function normalizeType(value: string): BingoCatalogType {
  const normalized = value.toUpperCase();
  if (normalized.includes("EVENT")) return "EVENT";
  if (normalized.includes("DAILY")) return "DAILY";
  return "REGION";
}

function isCompleted(status: string): boolean {
  return status === "CLEAR" || status === "PERFECT_CLEAR";
}

function toIso(value: Date | null): string | null {
  return value?.toISOString() ?? null;
}

function compareCatalogItems(
  left: BingoCatalogItem,
  right: BingoCatalogItem,
): number {
  const stateOrder: Record<BingoCatalogState, number> = {
    IN_PROGRESS: 0,
    AVAILABLE: 1,
    COMPLETED: 2,
  };
  const typeOrder: Record<BingoCatalogType, number> = {
    DAILY: 0,
    REGION: 1,
    EVENT: 2,
  };
  return (
    stateOrder[left.state] - stateOrder[right.state] ||
    typeOrder[left.type] - typeOrder[right.type] ||
    left.title.localeCompare(right.title, "ko")
  );
}

function missionSnapshot(mission: {
  readonly id: string;
  readonly kind: string;
  readonly title: string;
  readonly description: string;
  readonly category: string;
  readonly verificationPolicy: unknown;
  readonly targetValue: { toString(): string } | null;
  readonly targetUnit: string | null;
  readonly radiusM: number | null;
  readonly points: number;
  readonly difficulty: number;
  readonly estimatedMinutesMin: number | null;
  readonly estimatedMinutesMax: number | null;
  readonly similarityGroup: string | null;
  readonly place: {
    readonly id: string;
    readonly title: string;
    readonly latitude: { toString(): string };
    readonly longitude: { toString(): string };
  } | null;
}): Record<string, unknown> {
  return {
    id: mission.id,
    kind: mission.kind,
    title: mission.title,
    description: mission.description,
    category: mission.category,
    verificationPolicy: mission.verificationPolicy,
    targetValue: mission.targetValue?.toString() ?? null,
    targetUnit: mission.targetUnit,
    radiusM: mission.radiusM,
    points: mission.points,
    difficulty: mission.difficulty,
    estimatedMinutesMin: mission.estimatedMinutesMin,
    estimatedMinutesMax: mission.estimatedMinutesMax,
    similarityGroup: mission.similarityGroup,
    place: mission.place
      ? {
          id: mission.place.id,
          title: mission.place.title,
          latitude: mission.place.latitude.toString(),
          longitude: mission.place.longitude.toString(),
        }
      : null,
  };
}

function toBoardResult(session: {
  readonly id: string;
  readonly status: string;
  readonly totalPoints: number;
  readonly template: {
    readonly id: string;
    readonly type: string;
    readonly title: string;
    readonly region: {
      readonly name: string;
      readonly administrativeCode: string;
    };
  };
  readonly cells: readonly {
    readonly id: string;
    readonly position: number;
    readonly status: string;
    readonly missionSnapshot: unknown;
  }[];
}): BingoBoardResult {
  const progress = calculateBingoProgress(
    new Set(
      session.cells
        .filter((cell) => cell.status === "VERIFIED")
        .map((cell) => toBoardPosition(cell.position)),
    ),
  );
  return {
    id: session.id,
    templateId: session.template.id,
    type: normalizeType(session.template.type),
    title: session.template.title,
    regionName: session.template.region.name,
    regionCode: session.template.region.administrativeCode,
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

function toPublicMission(snapshot: unknown): unknown {
  if (typeof snapshot !== "object" || snapshot === null) return snapshot;
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
  };
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}
