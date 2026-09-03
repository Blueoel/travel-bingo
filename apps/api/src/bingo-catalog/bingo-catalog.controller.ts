import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
} from "@nestjs/common";

import { AuthService } from "../auth/auth.service.js";
import {
  BingoCatalogService,
  type BingoBoardResult,
  type BingoCatalogItem,
} from "./bingo-catalog.service.js";

@Controller("api/v1/bingos")
export class BingoCatalogController {
  constructor(
    private readonly catalog: BingoCatalogService,
    private readonly auth: AuthService,
  ) {}

  @Get()
  async list(
    @Headers("x-user-id") userId: string | undefined,
    @Headers("cookie") cookieHeader: string | undefined,
  ): Promise<{ readonly items: BingoCatalogItem[] }> {
    return {
      items: await this.catalog.list(
        await this.auth.requireUserId(cookieHeader, userId),
      ),
    };
  }

  @Get("sessions/:sessionId")
  async getSession(
    @Param("sessionId") sessionId: string,
    @Headers("x-user-id") userId: string | undefined,
    @Headers("cookie") cookieHeader: string | undefined,
  ): Promise<BingoBoardResult> {
    return this.catalog.getSession(
      await this.auth.requireUserId(cookieHeader, userId),
      sessionId,
    );
  }

  @Delete("sessions/:sessionId")
  async cancelSession(
    @Param("sessionId") sessionId: string,
    @Headers("x-user-id") userId: string | undefined,
    @Headers("cookie") cookieHeader: string | undefined,
  ): Promise<{ readonly success: true }> {
    await this.catalog.cancelRegionSession(
      await this.auth.requireUserId(cookieHeader, userId),
      sessionId,
    );
    return { success: true };
  }

  @Post(":templateId/sessions")
  async createSession(
    @Param("templateId") templateId: string,
    @Headers("x-user-id") userId: string | undefined,
    @Headers("cookie") cookieHeader: string | undefined,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
  ): Promise<BingoBoardResult> {
    if (!idempotencyKey || idempotencyKey.length > 100) {
      throw new BadRequestException("Idempotency-Key 헤더가 필요합니다.");
    }
    return this.catalog.createOrGetSession({
      userId: await this.auth.requireUserId(cookieHeader, userId),
      templateId,
      idempotencyKey,
    });
  }
}
