import { BadRequestException, Controller, Get, Headers, Query } from "@nestjs/common";

import { AuthService } from "../auth/auth.service.js";
import {
  RankingService,
  type RankingPeriod,
  type RankingScope,
} from "./ranking.service.js";

@Controller("api/v1/rankings")
export class RankingController {
  constructor(
    private readonly rankings: RankingService,
    private readonly auth: AuthService,
  ) {}

  @Get()
  async get(
    @Headers("cookie") cookie: string | undefined,
    @Headers("x-user-id") developmentUserId: string | undefined,
    @Query("period") periodValue?: string,
    @Query("scope") scopeValue?: string,
  ) {
    const userId = await this.auth.requireUserId(cookie, developmentUserId);
    const period = parseValue(
      periodValue ?? "DAILY",
      ["DAILY", "WEEKLY", "MONTHLY", "TOTAL"] as const,
    );
    const scope = parseValue(
      scopeValue ?? "ALL",
      ["ALL", "COMMON", "REGION"] as const,
    );
    return this.rankings.get(
      userId,
      period as RankingPeriod,
      scope as RankingScope,
    );
  }
}

function parseValue<const T extends readonly string[]>(
  value: string,
  allowed: T,
): T[number] {
  if (!allowed.includes(value)) {
    throw new BadRequestException(`Unsupported ranking filter: ${value}`);
  }
  return value as T[number];
}
