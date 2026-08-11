import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { DatabaseClient } from "@travel-bingo/database";
import {
  calculateBingoProgress,
  evaluateGpsVerification,
  findNewLineRewards,
  toBoardPosition,
  type BingoLineKey,
} from "@travel-bingo/domain";

import { DATABASE_CLIENT } from "../database/database.module.js";
import { MissionQrService } from "../qr/mission-qr.service.js";
import type { PhotoAnalysis } from "./photo-verification.service.js";

const POINTS_PER_LINE = 100;

export interface CompleteMissionCommand {
  readonly userId: string;
  readonly sessionId: string;
  readonly cellId: string;
  readonly idempotencyKey: string;
  readonly now?: Date;
}

export interface RequestPhotoReviewCommand {
  readonly userId: string;
  readonly sessionId: string;
  readonly cellId: string;
  readonly now?: Date;
}

export type MissionEvidence =
  | { readonly type: "CHECK_IN" }
  | { readonly type: "TEXT"; readonly text: string }
  | {
      readonly type: "TIMER";
      readonly startedAt: Date;
      readonly completedAt: Date;
    }
  | { readonly type: "QUIZ"; readonly answer: string }
  | { readonly type: "QR"; readonly token: string }
  | {
      readonly type: "PHOTO";
      readonly analysis: PhotoAnalysis;
      readonly imageDataUrl?: string;
    }
  | {
      readonly type: "GPS";
      readonly latitude: number;
      readonly longitude: number;
      readonly accuracyM: number;
      readonly measuredAt: Date;
    }
  | {
      readonly type: "ACTIVITY";
      readonly distanceM: number;
      readonly durationSeconds: number;
      readonly latitude: number;
      readonly longitude: number;
      readonly accuracyM: number;
      readonly measuredAt: Date;
    };

export interface MissionCompletionResult {
  readonly sessionId: string;
  readonly cellId: string;
  readonly cellStatus: string;
  readonly sessionStatus: string;
  readonly completedCellCount: number;
  readonly completedLineKeys: readonly BingoLineKey[];
  readonly totalPoints: number;
  readonly pointsEarned: number;
  readonly verificationStatus?: "APPROVED" | "REJECTED" | "NEEDS_REVIEW";
  readonly reasonCode?: string;
}

type MissionSnapshot = {
  readonly id?: unknown;
  readonly kind?: unknown;
  readonly points?: unknown;
  readonly radiusM?: unknown;
  readonly targetValue?: unknown;
  readonly targetUnit?: unknown;
  readonly verificationPolicy?: unknown;
  readonly place?: {
    readonly latitude?: unknown;
    readonly longitude?: unknown;
  } | null;
};

type MissionDecision =
  | {
      readonly approved: true;
      readonly reasonCode: string;
      readonly distanceM?: number;
    }
  | {
      readonly approved: false;
      readonly reasonCode: string;
      readonly distanceM?: number;
    };

@Injectable()
export class MissionCompletionService {
  constructor(
    @Inject(DATABASE_CLIENT) private readonly database: DatabaseClient,
    private readonly missionQrService: MissionQrService,
  ) {}

  async completeCheckIn(
    command: CompleteMissionCommand,
  ): Promise<MissionCompletionResult> {
    return this.verify(command, { type: "CHECK_IN" });
  }

  async requestPhotoReview(
    command: RequestPhotoReviewCommand,
  ): Promise<MissionCompletionResult> {
    const outcome = await this.database.$transaction(async (transaction) => {
      const cell = await transaction.sessionCell.findFirst({
        where: {
          id: command.cellId,
          sessionId: command.sessionId,
          session: { userId: command.userId },
        },
      });
      if (!cell) {
        throw new NotFoundException("The photo mission cell was not found.");
      }

      const verification = await transaction.verification.findFirst({
        where: {
          sessionCellId: cell.id,
          userId: command.userId,
          type: "PHOTO",
        },
        orderBy: { submittedAt: "desc" },
      });
      if (!verification) {
        throw new NotFoundException("A submitted photo could not be found.");
      }
      if (verification.status === "NEEDS_REVIEW") {
        return { reasonCode: verification.reasonCode ?? "PHOTO_NEEDS_REVIEW" };
      }
      if (
        verification.status !== "REJECTED" ||
        verification.reasonCode !== "PHOTO_AI_REJECTED"
      ) {
        throw new ConflictException(
          "Only an AI-rejected photo can be sent for administrator review.",
        );
      }

      const requestedAt = command.now ?? new Date();
      await transaction.verification.update({
        where: { id: verification.id },
        data: {
          status: "NEEDS_REVIEW",
          reasonCode: "PHOTO_USER_REVIEW_REQUESTED",
          reasonDetail: "참가자가 관리자 검수를 요청했습니다.",
          decidedAt: null,
        },
      });
      await transaction.sessionCell.update({
        where: { id: cell.id },
        data: { status: "SUBMITTED" },
      });
      await transaction.outboxEvent.create({
        data: {
          topic: "mission.review_requested",
          aggregateId: verification.id,
          payload: {
            userId: command.userId,
            sessionId: command.sessionId,
            cellId: cell.id,
            requestedAt: requestedAt.toISOString(),
            reasonCode: "PHOTO_USER_REVIEW_REQUESTED",
          },
        },
      });
      return { reasonCode: "PHOTO_USER_REVIEW_REQUESTED" };
    });

    return this.buildResult(
      command.sessionId,
      command.cellId,
      0,
      "NEEDS_REVIEW",
      outcome.reasonCode,
    );
  }

  async listPhotoReviewNotifications(userId: string) {
    const rows = await this.database.verification.findMany({
      where: {
        userId,
        type: "PHOTO",
        reasonCode: { in: ["PHOTO_ADMIN_APPROVED", "PHOTO_ADMIN_REJECTED"] },
        decidedAt: { not: null },
      },
      include: { sessionCell: { select: { missionSnapshot: true } } },
      orderBy: { decidedAt: "desc" },
      take: 30,
    });
    return rows.map((row) => {
      const mission = asRecord(row.sessionCell.missionSnapshot);
      return {
        id: row.id,
        missionTitle: String(mission?.title ?? "사진 미션"),
        decision: row.status === "APPROVED" ? "APPROVED" : "REJECTED",
        reason: row.reasonDetail,
        decidedAt: row.decidedAt!.toISOString(),
        isRead: row.seenAt !== null,
      };
    });
  }

  async markPhotoReviewNotificationRead(
    userId: string,
    id: string,
  ): Promise<{ read: boolean }> {
    const result = await this.database.verification.updateMany({
      where: {
        id,
        userId,
        type: "PHOTO",
        reasonCode: { in: ["PHOTO_ADMIN_APPROVED", "PHOTO_ADMIN_REJECTED"] },
      },
      data: { seenAt: new Date() },
    });
    if (!result.count) {
      throw new NotFoundException("The photo review notification was not found.");
    }
    return { read: true };
  }

  async verify(
    command: CompleteMissionCommand,
    evidence: MissionEvidence,
  ): Promise<MissionCompletionResult> {
    const existingVerification = await this.database.verification.findUnique({
      where: {
        userId_idempotencyKey: {
          userId: command.userId,
          idempotencyKey: command.idempotencyKey,
        },
      },
      include: { sessionCell: true },
    });

    if (existingVerification) {
      if (
        existingVerification.sessionCellId !== command.cellId ||
        existingVerification.sessionCell.sessionId !== command.sessionId
      ) {
        throw new ConflictException(
          "The Idempotency-Key was already used for another mission.",
        );
      }
      return this.buildResult(
        command.sessionId,
        command.cellId,
        0,
        existingVerification.status === "APPROVED"
          ? "APPROVED"
          : existingVerification.status === "REJECTED"
            ? "REJECTED"
            : existingVerification.status === "NEEDS_REVIEW"
              ? "NEEDS_REVIEW"
              : undefined,
        existingVerification.reasonCode ?? undefined,
      );
    }

    const outcome = await this.database.$transaction(async (transaction) => {
      const cell = await transaction.sessionCell.findFirst({
        where: {
          id: command.cellId,
          sessionId: command.sessionId,
          session: {
            userId: command.userId,
            status: { in: ["ACTIVE", "CLEAR"] },
          },
        },
      });

      if (!cell) {
        throw new NotFoundException("The active mission cell was not found.");
      }

      const mission = cell.missionSnapshot as MissionSnapshot;
      const decision = evaluateMission(
        mission,
        evidence,
        command.now ?? new Date(),
        this.missionQrService,
      );
      if (!decision.approved) {
        const needsReview = decision.reasonCode === "PHOTO_NEEDS_REVIEW";
        const verification = await transaction.verification.create({
          data: {
            sessionCellId: cell.id,
            userId: command.userId,
            idempotencyKey: command.idempotencyKey,
            type: verificationType(evidence),
            status: needsReview ? "NEEDS_REVIEW" : "REJECTED",
            latitude: isGpsEvidence(evidence) ? evidence.latitude : null,
            longitude: isGpsEvidence(evidence) ? evidence.longitude : null,
            accuracyM: isGpsEvidence(evidence) ? evidence.accuracyM : null,
            measuredAt: isGpsEvidence(evidence) ? evidence.measuredAt : null,
            distanceM: decision.distanceM ?? null,
            evidence: publicEvidence(evidence),
            reasonCode: decision.reasonCode,
            decidedAt: needsReview ? null : (command.now ?? new Date()),
          },
        });
        await transaction.sessionCell.update({
          where: { id: cell.id },
          data: { status: needsReview ? "SUBMITTED" : "REJECTED" },
        });
        await transaction.outboxEvent.create({
          data: {
            topic: needsReview ? "mission.review_requested" : "mission.rejected",
            aggregateId: verification.id,
            payload: {
              userId: command.userId,
              sessionId: command.sessionId,
              cellId: cell.id,
              reasonCode: decision.reasonCode,
            },
          },
        });
        return {
          pointsEarned: 0,
          verificationStatus: needsReview
            ? ("NEEDS_REVIEW" as const)
            : ("REJECTED" as const),
          reasonCode: decision.reasonCode,
        };
      }

      const claimed = await transaction.sessionCell.updateMany({
        where: {
          id: cell.id,
          status: { in: ["AVAILABLE", "REJECTED"] },
        },
        data: {
          status: "VERIFIED",
          verifiedAt: command.now ?? new Date(),
        },
      });
      if (claimed.count !== 1) {
        throw new ConflictException("This mission is already completed.");
      }

      const missionPoints =
        typeof mission.points === "number" &&
        Number.isInteger(mission.points) &&
        mission.points >= 0
          ? mission.points
          : 0;

      const verification = await transaction.verification.create({
        data: {
          sessionCellId: cell.id,
          userId: command.userId,
          idempotencyKey: command.idempotencyKey,
          type: verificationType(evidence),
          status: "APPROVED",
          latitude: isGpsEvidence(evidence) ? evidence.latitude : null,
          longitude: isGpsEvidence(evidence) ? evidence.longitude : null,
          accuracyM: isGpsEvidence(evidence) ? evidence.accuracyM : null,
          measuredAt: isGpsEvidence(evidence) ? evidence.measuredAt : null,
          distanceM: decision.distanceM ?? null,
          reasonCode: decision.reasonCode,
          decidedAt: command.now ?? new Date(),
          evidence: publicEvidence(evidence),
        },
      });

      if (missionPoints > 0) {
        await transaction.pointLedger.create({
          data: {
            userId: command.userId,
            sessionId: command.sessionId,
            referenceType: "SESSION_CELL",
            referenceId: cell.id,
            reason: "MISSION_COMPLETED",
            points: missionPoints,
          },
        });
      }

      const [verifiedCells, rewardedLines] = await Promise.all([
        transaction.sessionCell.findMany({
          where: { sessionId: command.sessionId, status: "VERIFIED" },
          select: { position: true },
        }),
        transaction.bingoLineReward.findMany({
          where: { sessionId: command.sessionId },
          select: { lineKey: true },
        }),
      ]);
      const progress = calculateBingoProgress(
        new Set(verifiedCells.map(({ position }) => toBoardPosition(position))),
      );
      const newLineRewards = findNewLineRewards(
        progress,
        new Set(rewardedLines.map(({ lineKey }) => lineKey as BingoLineKey)),
        POINTS_PER_LINE,
      );
      const linePoints = newLineRewards.reduce(
        (total, reward) => total + reward.points,
        0,
      );

      if (newLineRewards.length > 0) {
        await transaction.bingoLineReward.createMany({
          data: newLineRewards.map((reward) => ({
            sessionId: command.sessionId,
            lineKey: reward.lineKey,
            points: reward.points,
          })),
        });
        await transaction.pointLedger.createMany({
          data: newLineRewards.map((reward) => ({
            userId: command.userId,
            sessionId: command.sessionId,
            referenceType: "BINGO_LINE",
            referenceId: `${command.sessionId}:${reward.lineKey}`,
            reason: "LINE_COMPLETED",
            points: reward.points,
          })),
        });
      }

      const sessionStatus = progress.isPerfectClear
        ? "PERFECT_CLEAR"
        : progress.isClear
          ? "CLEAR"
          : "ACTIVE";
      await transaction.bingoSession.update({
        where: { id: command.sessionId },
        data: {
          status: sessionStatus,
          totalPoints: { increment: missionPoints + linePoints },
          completedAt:
            sessionStatus === "ACTIVE" ? null : (command.now ?? new Date()),
        },
      });
      await transaction.outboxEvent.create({
        data: {
          topic: "mission.verified",
          aggregateId: verification.id,
          payload: {
            userId: command.userId,
            sessionId: command.sessionId,
            cellId: cell.id,
            newLineKeys: newLineRewards.map((reward) => reward.lineKey),
          },
        },
      });

      return {
        pointsEarned: missionPoints + linePoints,
        verificationStatus: "APPROVED" as const,
        reasonCode: decision.reasonCode,
      };
    });

    return this.buildResult(
      command.sessionId,
      command.cellId,
      outcome.pointsEarned,
      outcome.verificationStatus,
      outcome.reasonCode,
    );
  }

  private async buildResult(
    sessionId: string,
    cellId: string,
    pointsEarned: number,
    verificationStatus?: "APPROVED" | "REJECTED" | "NEEDS_REVIEW",
    reasonCode?: string,
  ): Promise<MissionCompletionResult> {
    const session = await this.database.bingoSession.findUnique({
      where: { id: sessionId },
      include: {
        cells: {
          orderBy: { position: "asc" },
          select: { id: true, position: true, status: true },
        },
      },
    });
    if (!session) {
      throw new NotFoundException("The Daily bingo session was not found.");
    }
    const cell = session.cells.find((candidate) => candidate.id === cellId);
    if (!cell) {
      throw new NotFoundException("The mission cell was not found.");
    }
    const progress = calculateBingoProgress(
      new Set(
        session.cells
          .filter((candidate) => candidate.status === "VERIFIED")
          .map((candidate) => toBoardPosition(candidate.position)),
      ),
    );

    return {
      sessionId,
      cellId,
      cellStatus: cell.status,
      sessionStatus: session.status,
      completedCellCount: progress.completedCellCount,
      completedLineKeys: progress.completedLineKeys,
      totalPoints: session.totalPoints,
      pointsEarned,
      ...(verificationStatus ? { verificationStatus } : {}),
      ...(reasonCode ? { reasonCode } : {}),
    };
  }
}

export function evaluateMission(
  mission: MissionSnapshot,
  evidence: MissionEvidence,
  receivedAt: Date,
  qrVerifier?: Pick<MissionQrService, "inspect">,
): MissionDecision {
  if (mission.kind === "CHECK_IN" && evidence.type === "CHECK_IN") {
    const policy = asRecord(mission.verificationPolicy);
    if (!policy || policy.type === "CHECK_IN") {
      return { approved: true, reasonCode: "SELF_CHECK_IN" };
    }
  }

  if (mission.kind === "CHECK_IN" && evidence.type === "TEXT") {
    const policy = asRecord(mission.verificationPolicy);
    const maxLength = toFiniteNumber(policy?.maxLength) ?? 100;
    const text = evidence.text.trim();
    if (policy?.type !== "TEXT") {
      throw new ConflictException("The text record policy is invalid.");
    }
    if (text.length < 1) {
      return { approved: false, reasonCode: "TEXT_REQUIRED" };
    }
    return text.length <= maxLength
      ? { approved: true, reasonCode: "TEXT_RECORDED" }
      : { approved: false, reasonCode: "TEXT_TOO_LONG" };
  }

  if (mission.kind === "CHECK_IN" && evidence.type === "TIMER") {
    const policy = asRecord(mission.verificationPolicy);
    const durationSeconds = toFiniteNumber(policy?.durationSeconds);
    if (
      policy?.type !== "TIMER" ||
      durationSeconds === null ||
      durationSeconds <= 0
    ) {
      throw new ConflictException("The timer policy is invalid.");
    }
    const elapsedSeconds =
      (evidence.completedAt.getTime() - evidence.startedAt.getTime()) / 1000;
    if (
      evidence.startedAt.getTime() > receivedAt.getTime() + 5_000 ||
      evidence.completedAt.getTime() > receivedAt.getTime() + 5_000 ||
      elapsedSeconds < durationSeconds
    ) {
      return { approved: false, reasonCode: "TIMER_NOT_REACHED" };
    }
    return { approved: true, reasonCode: "TIMER_COMPLETED" };
  }

  if (mission.kind === "QUIZ" && evidence.type === "QUIZ") {
    const policy = asRecord(mission.verificationPolicy);
    const answerHash = policy?.answerHash;
    if (typeof answerHash !== "string") {
      throw new ConflictException("The quiz answer policy is invalid.");
    }
    const submittedHash = createHash("sha256")
      .update(normalizeAnswer(evidence.answer))
      .digest("hex");
    return submittedHash === answerHash
      ? { approved: true, reasonCode: "QUIZ_CORRECT" }
      : { approved: false, reasonCode: "QUIZ_INCORRECT" };
  }

  if (mission.kind === "QR_SCAN" && evidence.type === "QR") {
    const policy = asRecord(mission.verificationPolicy);
    if (
      policy?.type !== "QR_SCAN" ||
      typeof mission.id !== "string" ||
      !qrVerifier
    ) {
      throw new ConflictException("The QR mission policy is invalid.");
    }
    const inspection = qrVerifier.inspect(
      evidence.token,
      mission.id,
      receivedAt,
    );
    if (inspection.valid) {
      return { approved: true, reasonCode: "QR_VERIFIED" };
    }
    return {
      approved: false,
      reasonCode:
        inspection.reason === "EXPIRED" ? "QR_EXPIRED" : "QR_INVALID",
    };
  }

  if (mission.kind === "PLACE_VISIT" && evidence.type === "GPS") {
    const latitude = toFiniteNumber(mission.place?.latitude);
    const longitude = toFiniteNumber(mission.place?.longitude);
    const radiusM = toFiniteNumber(mission.radiusM);
    const policy = asRecord(mission.verificationPolicy);
    if (latitude === null || longitude === null || radiusM === null) {
      throw new ConflictException("The place GPS policy is invalid.");
    }
    const result = evaluateGpsVerification({
      target: { latitude, longitude },
      measured: {
        latitude: evidence.latitude,
        longitude: evidence.longitude,
      },
      accuracyM: evidence.accuracyM,
      measuredAt: evidence.measuredAt,
      receivedAt,
      rule: {
        radiusM,
        maximumAccuracyM: toFiniteNumber(policy?.maximumAccuracyM) ?? 50,
        maximumAgeMs: toFiniteNumber(policy?.maximumAgeMs) ?? 60_000,
      },
    });
    return result.approved
      ? {
          approved: true,
          reasonCode: "GPS_INSIDE_RADIUS",
          distanceM: result.distanceM,
        }
      : {
          approved: false,
          reasonCode: result.code,
          ...("distanceM" in result && result.distanceM !== undefined
            ? { distanceM: result.distanceM }
            : {}),
        };
  }

  if (mission.kind === "WALK_DISTANCE" && evidence.type === "ACTIVITY") {
    const policy = asRecord(mission.verificationPolicy);
    const minimumKilometers =
      toFiniteNumber(policy?.minimumKilometers) ??
      (mission.targetUnit === "KILOMETER"
        ? toFiniteNumber(mission.targetValue)
        : null);
    if (minimumKilometers === null || minimumKilometers <= 0) {
      throw new ConflictException("The walking distance policy is invalid.");
    }
    const targetDistanceM = minimumKilometers * 1_000;
    return evidence.distanceM >= targetDistanceM
      ? {
          approved: true,
          reasonCode: "GPS_DISTANCE_REACHED",
          distanceM: evidence.distanceM,
        }
      : {
          approved: false,
          reasonCode: "GPS_DISTANCE_NOT_REACHED",
          distanceM: evidence.distanceM,
        };
  }

  if (mission.kind === "COMPOSITE" && evidence.type === "ACTIVITY") {
    const policy = asRecord(mission.verificationPolicy);
    const policyType = policy?.type;
    const minimumSeconds =
      toFiniteNumber(policy?.minimumSeconds) ??
      toFiniteNumber(policy?.durationSeconds) ??
      (mission.targetUnit === "SECOND"
        ? toFiniteNumber(mission.targetValue)
        : null);
    if (
      (policyType !== "GPS_DURATION" && policyType !== "GPS_STAY") ||
      minimumSeconds === null ||
      minimumSeconds <= 0
    ) {
      throw new ConflictException("The GPS duration policy is invalid.");
    }
    if (evidence.durationSeconds < minimumSeconds) {
      return {
        approved: false,
        reasonCode: "GPS_DURATION_NOT_REACHED",
        distanceM: evidence.distanceM,
      };
    }
    const allowedDriftM = toFiniteNumber(policy?.allowedDriftM) ?? 50;
    if (
      policyType === "GPS_STAY" &&
      evidence.distanceM > Math.max(allowedDriftM * 2, 100)
    ) {
      return {
        approved: false,
        reasonCode: "GPS_STAY_MOVED_TOO_FAR",
        distanceM: evidence.distanceM,
      };
    }
    return {
      approved: true,
      reasonCode:
        policyType === "GPS_STAY"
          ? "GPS_STAY_COMPLETED"
          : "GPS_DURATION_REACHED",
      distanceM: evidence.distanceM,
    };
  }

  if (mission.kind === "PHOTO" && evidence.type === "PHOTO") {
    return evidence.analysis.decision === "APPROVED"
      ? { approved: true, reasonCode: "PHOTO_AI_APPROVED" }
      : {
          approved: false,
          reasonCode:
            evidence.analysis.decision === "NEEDS_REVIEW"
              ? "PHOTO_NEEDS_REVIEW"
              : "PHOTO_AI_REJECTED",
        };
  }

  throw new ForbiddenException(
    `Evidence type ${evidence.type} cannot verify mission kind ${String(mission.kind)}.`,
  );
}

function normalizeAnswer(answer: string): string {
  return answer.trim().toLocaleLowerCase("ko-KR").normalize("NFC");
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function toFiniteNumber(value: unknown): number | null {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function publicEvidence(
  evidence: MissionEvidence,
): Record<string, string | number | string[] | null> {
  if (evidence.type === "QUIZ") {
    return {
      method: evidence.type,
      submittedAnswerHash: createHash("sha256")
        .update(normalizeAnswer(evidence.answer))
        .digest("hex"),
    };
  }
  if (evidence.type === "QR") {
    return {
      method: evidence.type,
      tokenHash: createHash("sha256").update(evidence.token.trim()).digest("hex"),
    };
  }
  if (evidence.type === "PHOTO") {
    return {
      method: evidence.type,
      decision: evidence.analysis.decision,
      confidence: evidence.analysis.confidence,
      evidence: [...evidence.analysis.evidence],
      failureReasons: [...evidence.analysis.failureReasons],
      retryGuide: evidence.analysis.retryGuide,
      model: evidence.analysis.model,
      imageDataUrl: evidence.imageDataUrl ?? null,
    };
  }
  if (evidence.type === "TEXT") {
    return {
      method: evidence.type,
      text: evidence.text.trim(),
      characterCount: evidence.text.trim().length,
    };
  }
  if (evidence.type === "TIMER") {
    return {
      method: evidence.type,
      startedAt: evidence.startedAt.toISOString(),
      completedAt: evidence.completedAt.toISOString(),
      durationSeconds: Math.floor(
        (evidence.completedAt.getTime() - evidence.startedAt.getTime()) / 1000,
      ),
    };
  }
  if (evidence.type === "ACTIVITY") {
    return {
      method: evidence.type,
      distanceM: Math.round(evidence.distanceM),
      durationSeconds: Math.round(evidence.durationSeconds),
      accuracyM: Math.round(evidence.accuracyM),
    };
  }
  return { method: evidence.type };
}

function isGpsEvidence(
  evidence: MissionEvidence,
): evidence is Extract<MissionEvidence, { type: "GPS" | "ACTIVITY" }> {
  return evidence.type === "GPS" || evidence.type === "ACTIVITY";
}

function verificationType(
  evidence: MissionEvidence,
): "GPS" | "QR" | "QUIZ" | "PHOTO" | "COMPOSITE" | "ADMIN" {
  if (isGpsEvidence(evidence)) return "GPS";
  if (evidence.type === "QR") return "QR";
  if (evidence.type === "QUIZ") return "QUIZ";
  if (evidence.type === "PHOTO") return "PHOTO";
  if (evidence.type === "TIMER") return "COMPOSITE";
  return "ADMIN";
}
import { createHash } from "node:crypto";
