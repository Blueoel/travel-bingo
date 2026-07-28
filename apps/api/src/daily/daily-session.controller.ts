import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
} from "@nestjs/common";

import { AuthService } from "../auth/auth.service.js";
import {
  DailySessionService,
  type DailySessionResult,
} from "./daily-session.service.js";
import {
  MissionCompletionService,
  type MissionEvidence,
  type MissionCompletionResult,
} from "./mission-completion.service.js";
import { PhotoVerificationService } from "./photo-verification.service.js";

@Controller("api/v1/daily-sessions")
export class DailySessionController {
  constructor(
    private readonly dailySessionService: DailySessionService,
    private readonly missionCompletionService: MissionCompletionService,
    private readonly photoVerificationService: PhotoVerificationService,
    private readonly authService: AuthService,
  ) {}

  @Get("today")
  async getToday(
    @Headers("x-user-id") userId: string | undefined,
    @Headers("cookie") cookieHeader: string | undefined,
  ): Promise<DailySessionResult> {
    return this.dailySessionService.getToday({
      userId: await this.authService.requireUserId(cookieHeader, userId),
    });
  }

  @Post()
  async create(
    @Headers("x-user-id") userId: string | undefined,
    @Headers("cookie") cookieHeader: string | undefined,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
  ): Promise<DailySessionResult> {
    return this.dailySessionService.createOrGet({
      userId: await this.authService.requireUserId(cookieHeader, userId),
      idempotencyKey: requireIdempotencyKey(idempotencyKey),
    });
  }

  @Post(":sessionId/cells/:cellId/complete")
  async complete(
    @Param("sessionId") sessionId: string,
    @Param("cellId") cellId: string,
    @Headers("x-user-id") userId: string | undefined,
    @Headers("cookie") cookieHeader: string | undefined,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
  ): Promise<MissionCompletionResult> {
    return this.missionCompletionService.completeCheckIn({
      userId: await this.authService.requireUserId(cookieHeader, userId),
      sessionId,
      cellId,
      idempotencyKey: requireIdempotencyKey(idempotencyKey),
    });
  }

  @Post(":sessionId/cells/:cellId/verify")
  async verify(
    @Param("sessionId") sessionId: string,
    @Param("cellId") cellId: string,
    @Headers("x-user-id") userId: string | undefined,
    @Headers("cookie") cookieHeader: string | undefined,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Body() body: unknown,
  ): Promise<MissionCompletionResult> {
    const command = {
      userId: await this.authService.requireUserId(cookieHeader, userId),
      sessionId,
      cellId,
      idempotencyKey: requireIdempotencyKey(idempotencyKey),
    };
    const input = asInput(body);
    if (input.type === "PHOTO") {
      if (typeof input.imageDataUrl !== "string") {
        throw new BadRequestException("Photo image data is required.");
      }
      const analysis = await this.photoVerificationService.analyze({
        userId: command.userId,
        sessionId,
        cellId,
        imageDataUrl: input.imageDataUrl,
      });
      return this.missionCompletionService.verify(command, {
        type: "PHOTO",
        analysis,
      });
    }
    return this.missionCompletionService.verify(command, parseEvidence(body));
  }
}

function requireIdempotencyKey(value: string | undefined): string {
  if (!value || value.length > 100) {
    throw new BadRequestException(
      "An Idempotency-Key header of at most 100 characters is required.",
    );
  }
  return value;
}

function parseEvidence(body: unknown): MissionEvidence {
  const input = asInput(body);
  if (input.type === "QUIZ" && typeof input.answer === "string") {
    return { type: "QUIZ", answer: input.answer };
  }
  if (
    input.type === "GPS" &&
    typeof input.latitude === "number" &&
    typeof input.longitude === "number" &&
    typeof input.accuracyM === "number" &&
    typeof input.measuredAt === "string"
  ) {
    const measuredAt = new Date(input.measuredAt);
    if (!Number.isNaN(measuredAt.getTime())) {
      return {
        type: "GPS",
        latitude: input.latitude,
        longitude: input.longitude,
        accuracyM: input.accuracyM,
        measuredAt,
      };
    }
  }
  throw new BadRequestException("The mission evidence body is invalid.");
}

function asInput(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== "object" || !("type" in body)) {
    throw new BadRequestException("A mission evidence body is required.");
  }
  return body as Record<string, unknown>;
}
