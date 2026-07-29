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
import type { PhotoAnalysis } from "./photo-verification.service.js";

const POINTS_PER_LINE = 100;

export interface CompleteMissionCommand {
  readonly userId: string;
  readonly sessionId: string;
  readonly cellId: string;
  readonly idempotencyKey: string;
  readonly now?: Date;
}

export type MissionEvidence =
  | { readonly type: "CHECK_IN" }
  | { readonly type: "QUIZ"; readonly answer: string }
  | { readonly type: "PHOTO"; readonly analysis: PhotoAnalysis }
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
  readonly verificationStatus?: "APPROVED" | "REJECTED";
  readonly reasonCode?: string;
}

type MissionSnapshot = {
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
  ) {}

  async completeCheckIn(
    command: CompleteMissionCommand,
  ): Promise<MissionCompletionResult> {
    return this.verify(command, { type: "CHECK_IN" });
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
      );
      if (!decision.approved) {
        const verification = await transaction.verification.create({
          data: {
            sessionCellId: cell.id,
            userId: command.userId,
            idempotencyKey: command.idempotencyKey,
            type:
              isGpsEvidence(evidence)
                ? "GPS"
                : evidence.type === "PHOTO"
                  ? "PHOTO"
                  : "QUIZ",
            status: "REJECTED",
            latitude: isGpsEvidence(evidence) ? evidence.latitude : null,
            longitude: isGpsEvidence(evidence) ? evidence.longitude : null,
            accuracyM: isGpsEvidence(evidence) ? evidence.accuracyM : null,
            measuredAt: isGpsEvidence(evidence) ? evidence.measuredAt : null,
            distanceM: decision.distanceM ?? null,
            evidence: publicEvidence(evidence),
            reasonCode: decision.reasonCode,
            decidedAt: command.now ?? new Date(),
          },
        });
        await transaction.sessionCell.update({
          where: { id: cell.id },
          data: { status: "REJECTED" },
        });
        await transaction.outboxEvent.create({
          data: {
            topic: "mission.rejected",
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
          verificationStatus: "REJECTED" as const,
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
          type:
            isGpsEvidence(evidence)
              ? "GPS"
              : evidence.type === "QUIZ"
                ? "QUIZ"
                : evidence.type === "PHOTO"
                  ? "PHOTO"
                  : "ADMIN",
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
    verificationStatus?: "APPROVED" | "REJECTED",
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
): MissionDecision {
  if (mission.kind === "CHECK_IN" && evidence.type === "CHECK_IN") {
    return { approved: true, reasonCode: "SELF_CHECK_IN" };
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
  if (evidence.type === "PHOTO") {
    return {
      method: evidence.type,
      decision: evidence.analysis.decision,
      confidence: evidence.analysis.confidence,
      evidence: [...evidence.analysis.evidence],
      failureReasons: [...evidence.analysis.failureReasons],
      retryGuide: evidence.analysis.retryGuide,
      model: evidence.analysis.model,
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
import { createHash } from "node:crypto";
