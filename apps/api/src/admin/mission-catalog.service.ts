import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { createHash, randomUUID } from "node:crypto";
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
    | "PHOTO"
    | "GPS"
    | "GPS_STAY"
    | "QUIZ"
    | "TEXT"
    | "TIMER"
    | "QR_SCAN"
    | "MANUAL";
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
  readonly place?: {
    readonly title: string;
    readonly address?: string | null;
    readonly latitude: number;
    readonly longitude: number;
    readonly externalContentId?: string | null;
    readonly contentType?: string | null;
    readonly imageUrl?: string | null;
    readonly source?: "ADMIN" | "KTO";
  } | null;
  readonly regionIds: readonly string[];
  readonly status?: "ACTIVE" | "INACTIVE" | "NEEDS_REVIEW";
  readonly changeNote?: string;
}

export interface DailyCollectionInput {
  readonly missionIds: readonly string[];
}

export interface RegionAdminSummary {
  readonly id: string;
  readonly name: string;
  readonly administrativeCode: string;
  readonly status: "ACTIVE" | "INACTIVE" | "NEEDS_REVIEW";
  readonly activeMissionCount: number;
  readonly publishedBoardCount: number;
  readonly canActivate: boolean;
  readonly missingMissionCount: number;
}

@Injectable()
export class MissionCatalogService {
  constructor(
    @Inject(DATABASE_CLIENT) private readonly database: DatabaseClient,
  ) {}

  async getQrMission(id: string): Promise<{
    readonly id: string;
    readonly title: string;
    readonly status: string;
  }> {
    const mission = await this.database.mission.findUnique({
      where: { id },
      select: { id: true, title: true, kind: true, status: true },
    });
    if (!mission) throw new NotFoundException("Mission not found.");
    if (mission.kind !== "QR_SCAN") {
      throw new BadRequestException("Only QR missions can issue a QR code.");
    }
    return mission;
  }

  async listRegions(): Promise<RegionAdminSummary[]> {
    const regions = await this.database.region.findMany({
      orderBy: { name: "asc" },
      include: {
        missionLinks: {
          where: { mission: { status: "ACTIVE", scope: "REGION" } },
          select: { missionId: true },
        },
        templates: {
          where: { status: "PUBLISHED", type: "REGION" },
          select: {
            id: true,
            title: true,
            _count: { select: { cells: true } },
          },
        },
      },
    });
    return regions.map((region) => {
      const publishedBoardCount = region.templates.filter(
        (template) => template._count.cells === 25,
      ).length;
      const activeMissionCount = region.missionLinks.length;
      return {
        id: region.id,
        name: region.name,
        administrativeCode: region.administrativeCode,
        status: region.status,
        activeMissionCount,
        publishedBoardCount,
        canActivate: activeMissionCount >= 25,
        missingMissionCount: Math.max(0, 25 - activeMissionCount),
      };
    });
  }

  async updateRegionStatus(
    id: string,
    status: "ACTIVE" | "INACTIVE",
    adminId: string,
  ): Promise<RegionAdminSummary> {
    const regions = await this.listRegions();
    const region = regions.find((candidate) => candidate.id === id);
    if (!region) throw new NotFoundException("Region not found.");
    if (status === "ACTIVE" && !region.canActivate) {
      throw new BadRequestException(
        "활성 지역 미션이 25개 이상 있어야 지역 서비스를 활성화할 수 있습니다.",
      );
    }
    if (status === "INACTIVE") {
      await this.database.region.update({
        where: { id },
        data: { status },
      });
      return { ...region, status };
    }

    await this.database.$transaction(async (transaction) => {
      const regionRecord = await transaction.region.findUnique({
        where: { id },
        include: {
          missionLinks: {
            where: { mission: { status: "ACTIVE", scope: "REGION" } },
            orderBy: { createdAt: "asc" },
            select: { missionId: true },
          },
          templates: {
            where: { status: "PUBLISHED", type: "REGION" },
            select: { id: true, _count: { select: { cells: true } } },
          },
        },
      });
      if (!regionRecord) throw new NotFoundException("Region not found.");
      if (regionRecord.missionLinks.length < 25) {
        throw new BadRequestException(
          `지역 서비스를 활성화하려면 활성 지역 미션이 25개 필요합니다. 현재 ${regionRecord.missionLinks.length}개입니다.`,
        );
      }
      const hasReadyTemplate = regionRecord.templates.some(
        (template) => template._count.cells === 25,
      );
      if (!hasReadyTemplate) {
        let theme = await transaction.bingoTheme.findFirst({
          where: { regionId: id, status: "ACTIVE" },
          orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
        });
        if (!theme) {
          theme = await transaction.bingoTheme.create({
            data: {
              regionId: id,
              name: "대표 여행",
              category: "지역 탐험",
              isRequiredForRegionCompletion: true,
              status: "ACTIVE",
              displayOrder: 0,
            },
          });
        }
        const latest = await transaction.bingoTemplate.findFirst({
          where: { themeId: theme.id },
          orderBy: { version: "desc" },
          select: { version: true },
        });
        await transaction.bingoTemplate.updateMany({
          where: { regionId: id, type: "REGION", status: "PUBLISHED" },
          data: { status: "ARCHIVED" },
        });
        await transaction.bingoTemplate.create({
          data: {
            regionId: id,
            themeId: theme.id,
            ownerId: adminId,
            title: `${regionRecord.name} 여행 빙고`,
            type: "REGION",
            status: "PUBLISHED",
            version: (latest?.version ?? 0) + 1,
            startsAt: new Date(),
            publishedAt: new Date(),
            cells: {
              create: regionRecord.missionLinks
                .slice(0, 25)
                .map(({ missionId }, position) => ({ missionId, position })),
            },
          },
        });
      }
      await transaction.region.update({
        where: { id },
        data: { status: "ACTIVE" },
      });
    });
    const activated = (await this.listRegions()).find(
      (region) => region.id === id,
    );
    if (!activated) throw new NotFoundException("Region not found.");
    return activated;
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
          place: true,
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
    await this.assertNoDuplicateKtoMission(input);
    const mission = await this.database.$transaction(async (transaction) => {
      const placeId = await resolvePlaceId(transaction, input);
      const created = await transaction.mission.create({
        data: {
          ...missionData(input),
          placeId,
          regionLinks: {
            create: input.regionIds.map((regionId) => ({ regionId })),
          },
        } as any,
        include: { regionLinks: { include: { region: true } }, place: true },
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

  private async assertNoDuplicateKtoMission(
    input: MissionCatalogInput,
  ): Promise<void> {
    const externalContentId = input.place?.externalContentId?.trim();
    const regionId = input.regionIds[0];
    if (input.place?.source !== "KTO" || !externalContentId || !regionId) {
      return;
    }
    const contentType = input.place.contentType?.trim() || "TOURIST_SPOT";
    const duplicate = await this.database.mission.findFirst({
      where: {
        scope: "REGION",
        regionLinks: { some: { regionId } },
        place: {
          is: {
            source: "KTO",
            externalContentId,
            contentType,
          },
        },
      },
      select: { title: true },
    });
    if (duplicate) {
      throw new ConflictException(
        `이 관광지는 이미 '${duplicate.title}' 미션으로 등록되어 있습니다.`,
      );
    }
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
      const placeId = await resolvePlaceId(
        transaction,
        input,
        existing.placeId,
      );
      await transaction.missionRegion.deleteMany({ where: { missionId: id } });
      const updated = await transaction.mission.update({
        where: { id },
        data: {
          ...missionData(input),
          placeId,
          regionLinks: {
            create: input.regionIds.map((regionId) => ({ regionId })),
          },
        } as any,
        include: { regionLinks: { include: { region: true } }, place: true },
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

  async listPhotoReviews(history = false) {
    const verifications = await this.database.verification.findMany({
      where: history
        ? { type: "PHOTO", status: { in: ["APPROVED", "REJECTED"] } }
        : { type: "PHOTO", status: "NEEDS_REVIEW" },
      include: {
        user: { select: { nickname: true, email: true } },
        sessionCell: { select: { missionSnapshot: true } },
      },
      orderBy: { submittedAt: "desc" },
      take: 100,
    });
    return {
      reviews: verifications.map((verification) => {
        const mission = asRecord(verification.sessionCell.missionSnapshot);
        const evidence = asRecord(verification.evidence);
        return {
          id: verification.id,
          missionTitle: String(mission?.title ?? "사진 미션"),
          missionDescription: String(mission?.description ?? ""),
          verificationLabel: "사진 인증",
          guestId:
            verification.user.nickname || verification.user.email || "참가자",
          points: Number(mission?.points ?? 0),
          confidence: Number(evidence?.confidence ?? 0),
          evidence: stringList(evidence?.evidence),
          failureReasons: stringList(evidence?.failureReasons),
          submittedAt: verification.submittedAt.toISOString(),
          reviewDecision:
            verification.status === "APPROVED"
              ? "APPROVED"
              : verification.status === "REJECTED"
                ? "REJECTED"
                : null,
          reviewReason: verification.reasonDetail,
          reviewerEmail: null,
          reviewedAt: verification.decidedAt?.toISOString() ?? null,
          imageUrl: String(evidence?.imageDataUrl ?? ""),
          source: "BACKEND" as const,
        };
      }),
    };
  }

  async reviewPhoto(
    id: string,
    decision: "APPROVED" | "REJECTED",
    reason: string | undefined,
  ) {
    const normalizedReason = reason?.trim() || null;
    if (decision === "REJECTED" && !normalizedReason) {
      throw new BadRequestException("사진을 반려하려면 사유를 입력해주세요.");
    }
    if (normalizedReason && normalizedReason.length > 500) {
      throw new BadRequestException("반려 사유는 500자 이하로 입력해주세요.");
    }
    return this.database.$transaction(async (transaction) => {
      const verification = await transaction.verification.findUnique({
        where: { id },
        include: { sessionCell: { include: { session: true } } },
      });
      if (!verification || verification.status !== "NEEDS_REVIEW") {
        throw new NotFoundException(
          "검수 대기 중인 사진 인증을 찾을 수 없습니다.",
        );
      }
      const mission = asRecord(verification.sessionCell.missionSnapshot);
      const points = Math.max(0, Number(mission?.points ?? 0));
      const approved = decision === "APPROVED";
      const decidedAt = new Date();
      await transaction.verification.update({
        where: { id },
        data: {
          status: decision,
          reasonCode: approved
            ? "PHOTO_ADMIN_APPROVED"
            : "PHOTO_ADMIN_REJECTED",
          reasonDetail: normalizedReason,
          decidedAt,
          seenAt: null,
        },
      });
      await transaction.sessionCell.update({
        where: { id: verification.sessionCellId },
        data: approved
          ? { status: "VERIFIED", verifiedAt: new Date() }
          : { status: "REJECTED" },
      });
      if (approved && points > 0) {
        await transaction.pointLedger.create({
          data: {
            userId: verification.userId,
            sessionId: verification.sessionCell.sessionId,
            referenceType: "SESSION_CELL",
            referenceId: verification.sessionCellId,
            reason: "MISSION_COMPLETED",
            points,
          },
        });
        await transaction.bingoSession.update({
          where: { id: verification.sessionCell.sessionId },
          data: { totalPoints: { increment: points } },
        });
      }
      await transaction.outboxEvent.create({
        data: {
          topic: "mission.review_decided",
          aggregateId: verification.id,
          payload: {
            userId: verification.userId,
            sessionId: verification.sessionCell.sessionId,
            cellId: verification.sessionCellId,
            decision,
            reason: normalizedReason,
            decidedAt: decidedAt.toISOString(),
          },
        },
      });
      return { id, decision };
    });
  }
}

function missionData(input: MissionCatalogInput) {
  const verificationPolicy = normalizeVerificationPolicy(input);
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
    verificationPolicy,
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

  if (type === "QUIZ") {
    const answer = policy?.answer;
    if (typeof answer !== "string" || !answer.trim() || answer.length > 100) {
      throw new BadRequestException(
        "Quiz missions require an answer between 1 and 100 characters.",
      );
    }
  }
  if (type === "QR_SCAN" && input.kind && input.kind !== "QR_SCAN") {
    throw new BadRequestException("QR verification requires a QR mission.");
  }
  if (type === "GPS") {
    const place = input.place;
    if (
      input.scope !== "REGION" ||
      input.regionIds.length !== 1 ||
      !place?.title.trim() ||
      !Number.isFinite(place.latitude) ||
      place.latitude < -90 ||
      place.latitude > 90 ||
      !Number.isFinite(place.longitude) ||
      place.longitude < -180 ||
      place.longitude > 180 ||
      !Number.isInteger(input.radiusM) ||
      Number(input.radiusM) < 30 ||
      Number(input.radiusM) > 1000
    ) {
      throw new BadRequestException(
        "GPS missions require one region, valid place coordinates, and a radius between 30 and 1000 meters.",
      );
    }
  }
}

function normalizeVerificationPolicy(
  input: MissionCatalogInput,
): Record<string, unknown> {
  const policy = input.verificationPolicy ?? {
    type: input.verificationType ?? "MANUAL",
  };
  if (policy.type !== "QUIZ") return policy;
  const answer = String(policy.answer ?? "").trim();
  return {
    ...policy,
    answer,
    answerHash: createHash("sha256")
      .update(answer.toLocaleLowerCase("ko-KR").normalize("NFC"))
      .digest("hex"),
  };
}

async function resolvePlaceId(
  transaction: any,
  input: MissionCatalogInput,
  existingPlaceId?: string | null,
): Promise<string | null> {
  if (!input.place) return null;
  const placeData = {
    regionId: input.regionIds[0],
    source: input.place.source ?? "ADMIN",
    externalContentId:
      input.place.externalContentId?.trim() || `admin-${randomUUID()}`,
    contentType: input.place.contentType?.trim() || "TOURIST_SPOT",
    title: input.place.title.trim(),
    address: input.place.address?.trim() || null,
    latitude: input.place.latitude,
    longitude: input.place.longitude,
    imageUrl: input.place.imageUrl?.trim() || null,
    status: "ACTIVE",
    syncedAt: new Date(),
  };
  if (existingPlaceId) {
    const updated = await transaction.place.update({
      where: { id: existingPlaceId },
      data: placeData,
      select: { id: true },
    });
    return updated.id;
  }
  const created = await transaction.place.upsert({
    where: {
      source_externalContentId_contentType: {
        source: placeData.source,
        externalContentId: placeData.externalContentId,
        contentType: placeData.contentType,
      },
    },
    update: placeData,
    create: placeData,
    select: { id: true },
  });
  return created.id;
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
  if (value === "GPS") return "PLACE_VISIT";
  if (value === "GPS_STAY") return "COMPOSITE";
  if (value === "QR_SCAN") return "QR_SCAN";
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

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}
