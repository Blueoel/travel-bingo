import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { DatabaseClient } from "@travel-bingo/database";
import {
  pointsForDifficulty,
  type MissionDifficulty,
} from "@travel-bingo/domain";

import { DATABASE_CLIENT } from "../database/database.module.js";

const DIFFICULTY_VALUES: Record<MissionDifficulty, number> = {
  EASY: 1,
  NORMAL: 2,
  HARD: 3,
  SPECIAL: 4,
};

export interface MissionCatalogQuery {
  readonly q?: string;
  readonly scope?: "COMMON" | "REGION" | "EVENT";
  readonly regionId?: string;
  readonly category?: string;
  readonly status?: "ACTIVE" | "INACTIVE" | "NEEDS_REVIEW";
  readonly difficulty?: 1 | 2 | 3 | 4;
  readonly kind?: MissionCatalogInput["kind"];
  readonly similarityGroup?: string;
  readonly dailyCandidate?: boolean;
  readonly page: number;
  readonly pageSize: number;
}

export interface MissionCatalogInput {
  readonly title: string;
  readonly description: string;
  readonly kind?:
    | "PLACE_VISIT"
    | "WALK_STEPS"
    | "WALK_DISTANCE"
    | "QUIZ"
    | "QR_SCAN"
    | "PHOTO"
    | "CHECK_IN"
    | "COMPOSITE";
  readonly verificationType?:
    "PHOTO" | "GPS" | "GPS_STAY" | "QUIZ" | "TEXT" | "TIMER" | "MANUAL";
  readonly scope: "COMMON" | "REGION" | "EVENT";
  readonly category: string;
  readonly difficulty: MissionDifficulty;
  readonly estimatedMinutesMin?: number | null;
  readonly estimatedMinutesMax?: number | null;
  readonly similarityGroup?: string | null;
  readonly verificationPolicy?: Record<string, unknown>;
  readonly targetValue?: number | null;
  readonly targetUnit?: string | null;
  readonly radiusM?: number | null;
  readonly regionIds: readonly string[];
  readonly status?: "ACTIVE" | "INACTIVE" | "NEEDS_REVIEW";
  readonly changeNote?: string;
}

export interface DailyCollectionInput {
  readonly missionIds: readonly string[];
}

@Injectable()
export class MissionCatalogService {
  constructor(
    @Inject(DATABASE_CLIENT) private readonly database: DatabaseClient,
  ) {}

  async listRegions() {
    return this.database.region.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
  }

  async list(query: MissionCatalogQuery) {
    const where = {
      ...(query.q
        ? {
            OR: [
              { title: { contains: query.q, mode: "insensitive" as const } },
              {
                description: {
                  contains: query.q,
                  mode: "insensitive" as const,
                },
              },
            ],
          }
        : {}),
      ...(query.scope ? { scope: query.scope } : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.difficulty ? { difficulty: query.difficulty } : {}),
      ...(query.kind ? { kind: query.kind } : {}),
      ...(query.similarityGroup
        ? { similarityGroup: query.similarityGroup }
        : {}),
      ...(query.dailyCandidate === true
        ? {
            collectionItems: {
              some: { collection: { type: "DAILY", regionId: null } },
            },
          }
        : query.dailyCandidate === false
          ? {
              collectionItems: {
                none: { collection: { type: "DAILY", regionId: null } },
              },
            }
          : {}),
      ...(query.regionId
        ? { regionLinks: { some: { regionId: query.regionId } } }
        : {}),
    };
    const [items, total] = await this.database.$transaction([
      this.database.mission.findMany({
        where,
        orderBy: [{ updatedAt: "desc" }, { title: "asc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          regionLinks: { include: { region: true } },
          collectionItems: { include: { collection: true } },
        },
      }),
      this.database.mission.count({ where }),
    ]);
    return {
      items: items.map(toCatalogMission),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  async create(input: MissionCatalogInput, adminId: string) {
    validateInput(input);
    const mission = await this.database.$transaction(async (transaction) => {
      const created = await transaction.mission.create({
        data: {
          ...missionData(input),
          regionLinks: {
            create: input.regionIds.map((regionId) => ({ regionId })),
          },
        } as any,
        include: { regionLinks: { include: { region: true } } },
      });
      await transaction.missionRevision.create({
        data: {
          missionId: created.id,
          revision: 1,
          snapshot: revisionSnapshot(created) as any,
          changeNote: input.changeNote ?? "미션 생성",
          changedById: adminId,
        },
      });
      return created;
    });
    return toCatalogMission(mission);
  }

  async update(id: string, input: MissionCatalogInput, adminId: string) {
    validateInput(input);
    const existing = await this.database.mission.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Mission not found.");

    const mission = await this.database.$transaction(async (transaction) => {
      const revision = await transaction.missionRevision.aggregate({
        where: { missionId: id },
        _max: { revision: true },
      });
      await transaction.missionRegion.deleteMany({ where: { missionId: id } });
      const updated = await transaction.mission.update({
        where: { id },
        data: {
          ...missionData(input),
          regionLinks: {
            create: input.regionIds.map((regionId) => ({ regionId })),
          },
        } as any,
        include: { regionLinks: { include: { region: true } } },
      });
      await transaction.missionRevision.create({
        data: {
          missionId: id,
          revision: (revision._max.revision ?? 0) + 1,
          snapshot: revisionSnapshot(updated) as any,
          changeNote: input.changeNote ?? "미션 수정",
          changedById: adminId,
        },
      });
      return updated;
    });
    return toCatalogMission(mission);
  }

  async exportCsv(query: MissionCatalogQuery): Promise<string> {
    const result = await this.list({ ...query, page: 1, pageSize: 10_000 });
    const rows = [
      [
        "ID",
        "미션명",
        "범위",
        "지역",
        "유형",
        "카테고리",
        "난이도",
        "포인트",
        "예상시간(분)",
        "상태",
        "유사그룹",
      ],
      ...result.items.map((mission) => [
        mission.id,
        mission.title,
        mission.scope,
        mission.regions
          .map((region: { name: string }) => region.name)
          .join("|"),
        mission.kind,
        mission.category,
        difficultyName(mission.difficulty),
        String(mission.points),
        estimatedMinutes(mission),
        mission.status,
        mission.similarityGroup ?? "",
      ]),
    ];
    return `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
  }

  async getDailyCollection() {
    const collection = await this.database.missionCollection.findFirst({
      where: { type: "DAILY", regionId: null },
      include: {
        items: {
          orderBy: { displayOrder: "asc" },
          include: {
            mission: {
              include: { regionLinks: { include: { region: true } } },
            },
          },
        },
      },
    });
    if (!collection) throw new NotFoundException("Daily collection not found.");
    return {
      id: collection.id,
      name: collection.name,
      description: collection.description,
      missionIds: collection.items.map((item) => item.missionId),
      items: collection.items.map((item) => toCatalogMission(item.mission)),
    };
  }

  async updateDailyCollection(input: DailyCollectionInput) {
    const missionIds = [...new Set(input.missionIds)];
    if (missionIds.length < 25 || missionIds.length > 100) {
      throw new BadRequestException(
        "Daily collection requires between 25 and 100 unique missions.",
      );
    }
    const eligibleCount = await this.database.mission.count({
      where: {
        id: { in: missionIds },
        scope: "COMMON",
        status: "ACTIVE",
      },
    });
    if (eligibleCount !== missionIds.length) {
      throw new BadRequestException(
        "Daily collection only accepts active common missions.",
      );
    }
    const collection = await this.database.missionCollection.findFirst({
      where: { type: "DAILY", regionId: null },
      select: { id: true },
    });
    if (!collection) throw new NotFoundException("Daily collection not found.");

    await this.database.$transaction(async (transaction) => {
      await transaction.missionCollectionItem.deleteMany({
        where: { collectionId: collection.id },
      });
      await transaction.missionCollectionItem.createMany({
        data: missionIds.map((missionId, displayOrder) => ({
          collectionId: collection.id,
          missionId,
          displayOrder,
          weight: 100,
        })),
      });
    });
    return this.getDailyCollection();
  }
}

function missionData(input: MissionCatalogInput) {
  return {
    title: input.title.trim(),
    description: input.description.trim(),
    kind: input.kind ?? verificationKind(input.verificationType),
    scope: input.scope,
    category: input.category.trim(),
    difficulty: DIFFICULTY_VALUES[input.difficulty],
    points: pointsForDifficulty(input.difficulty),
    estimatedMinutesMin: input.estimatedMinutesMin ?? null,
    estimatedMinutesMax: input.estimatedMinutesMax ?? null,
    similarityGroup: input.similarityGroup?.trim() || null,
    verificationPolicy: input.verificationPolicy ?? {
      type: input.verificationType ?? "MANUAL",
    },
    targetValue: input.targetValue ?? null,
    targetUnit: input.targetUnit?.trim() || null,
    radiusM: input.radiusM ?? null,
    status: input.status ?? "ACTIVE",
  };
}

function validateInput(input: MissionCatalogInput): void {
  if (!input.title.trim() || input.title.length > 120) {
    throw new BadRequestException("Mission title is required.");
  }
  if (!input.description.trim() || !input.category.trim()) {
    throw new BadRequestException("Description and category are required.");
  }
  if (input.scope === "REGION" && input.regionIds.length === 0) {
    throw new BadRequestException(
      "A region-scoped mission requires at least one region.",
    );
  }
  if (input.scope === "COMMON" && input.regionIds.length > 0) {
    throw new BadRequestException(
      "A common mission cannot have region assignments.",
    );
  }
  const min = input.estimatedMinutesMin;
  const max = input.estimatedMinutesMax;
  if (
    (min != null && (!Number.isInteger(min) || min < 1)) ||
    (max != null && (!Number.isInteger(max) || max < 1)) ||
    (min != null && max != null && min > max)
  ) {
    throw new BadRequestException("Estimated minutes are invalid.");
  }
  validateVerificationPolicy(input);
}

function validateVerificationPolicy(input: MissionCatalogInput): void {
  const policy = input.verificationPolicy;
  const type = policy?.type ?? input.verificationType;
  if (type === "TEXT") {
    const maxLength = policy?.maxLength;
    if (
      !Number.isInteger(maxLength) ||
      Number(maxLength) < 1 ||
      Number(maxLength) > 100
    ) {
      throw new BadRequestException(
        "Text missions require maxLength between 1 and 100.",
      );
    }
  }
  if (type === "TIMER") {
    const durationSeconds = policy?.durationSeconds;
    if (
      !Number.isInteger(durationSeconds) ||
      Number(durationSeconds) < 60 ||
      Number(durationSeconds) > 10_800
    ) {
      throw new BadRequestException(
        "Timer missions require durationSeconds between 60 and 10800.",
      );
    }
  }
}

function revisionSnapshot(mission: Record<string, unknown>) {
  const { regionLinks: _regionLinks, ...snapshot } = mission;
  return snapshot;
}

function toCatalogMission(mission: any) {
  return {
    ...mission,
    targetValue: mission.targetValue?.toString() ?? null,
    regions:
      mission.regionLinks?.map((link: any) => ({
        id: link.region.id,
        name: link.region.name,
      })) ?? [],
    collections:
      mission.collectionItems?.map((item: any) => ({
        id: item.collection.id,
        name: item.collection.name,
        type: item.collection.type,
      })) ?? [],
    regionLinks: undefined,
    collectionItems: undefined,
  };
}

function difficultyName(value: number): string {
  return value === 1
    ? "쉬움"
    : value === 2
      ? "보통"
      : value === 3
        ? "어려움"
        : "특별";
}

function verificationKind(
  value: MissionCatalogInput["verificationType"],
): NonNullable<MissionCatalogInput["kind"]> {
  if (value === "PHOTO") return "PHOTO";
  if (value === "QUIZ") return "QUIZ";
  if (value === "TEXT" || value === "TIMER") return "CHECK_IN";
  if (value === "GPS" || value === "GPS_STAY") return "CHECK_IN";
  return "COMPOSITE";
}

function estimatedMinutes(mission: {
  estimatedMinutesMin: number | null;
  estimatedMinutesMax: number | null;
}): string {
  const { estimatedMinutesMin: min, estimatedMinutesMax: max } = mission;
  if (min == null && max == null) return "";
  if (min == null) return String(max);
  if (max == null || min === max) return String(min);
  return `${min}~${max}`;
}

function csvCell(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}
