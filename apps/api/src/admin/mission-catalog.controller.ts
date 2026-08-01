import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Res,
} from "@nestjs/common";

import { AuthService } from "../auth/auth.service.js";
import {
  MissionCatalogService,
  type MissionCatalogInput,
  type MissionCatalogQuery,
  type DailyCollectionInput,
  type RegionAdminSummary,
} from "./mission-catalog.service.js";

interface CsvResponse {
  header(name: string, value: string): void;
}

@Controller("api/v1/admin/missions")
export class MissionCatalogController {
  constructor(
    private readonly missions: MissionCatalogService,
    private readonly auth: AuthService,
  ) {}

  @Get("regions")
  async listRegions(
    @Headers("cookie") cookie: string | undefined,
    @Headers("x-user-id") developmentUserId: string | undefined,
  ): Promise<RegionAdminSummary[]> {
    await this.auth.requireAdminId(cookie, developmentUserId);
    return this.missions.listRegions();
  }

  @Get()
  async list(
    @Headers("cookie") cookie: string | undefined,
    @Headers("x-user-id") developmentUserId: string | undefined,
    @Query() query: Record<string, string | undefined>,
  ) {
    await this.auth.requireAdminId(cookie, developmentUserId);
    return this.missions.list(parseQuery(query));
  }

  @Get("export.csv")
  async exportCsv(
    @Headers("cookie") cookie: string | undefined,
    @Headers("x-user-id") developmentUserId: string | undefined,
    @Query() query: Record<string, string | undefined>,
    @Res({ passthrough: true }) response: CsvResponse,
  ): Promise<string> {
    await this.auth.requireAdminId(cookie, developmentUserId);
    response.header("content-type", "text/csv; charset=utf-8");
    response.header(
      "content-disposition",
      'attachment; filename="travel-bingo-missions.csv"',
    );
    return this.missions.exportCsv(parseQuery(query));
  }

  @Post()
  async create(
    @Headers("cookie") cookie: string | undefined,
    @Headers("x-user-id") developmentUserId: string | undefined,
    @Body() body: MissionCatalogInput,
  ) {
    const adminId = await this.auth.requireAdminId(cookie, developmentUserId);
    return this.missions.create(body, adminId);
  }

  @Get("collections/daily")
  async getDailyCollection(
    @Headers("cookie") cookie: string | undefined,
    @Headers("x-user-id") developmentUserId: string | undefined,
  ) {
    await this.auth.requireAdminId(cookie, developmentUserId);
    return this.missions.getDailyCollection();
  }

  @Put("collections/daily")
  async updateDailyCollection(
    @Headers("cookie") cookie: string | undefined,
    @Headers("x-user-id") developmentUserId: string | undefined,
    @Body() body: DailyCollectionInput,
  ) {
    await this.auth.requireAdminId(cookie, developmentUserId);
    return this.missions.updateDailyCollection(body);
  }

  @Patch("regions/:id/status")
  async updateRegionStatus(
    @Param("id") id: string,
    @Headers("cookie") cookie: string | undefined,
    @Headers("x-user-id") developmentUserId: string | undefined,
    @Body() body: { status?: string },
  ): Promise<RegionAdminSummary> {
    await this.auth.requireAdminId(cookie, developmentUserId);
    if (body.status !== "ACTIVE" && body.status !== "INACTIVE") {
      throw new BadRequestException("Region status must be ACTIVE or INACTIVE.");
    }
    return this.missions.updateRegionStatus(id, body.status);
  }

  @Post("regions/:id/publish-board")
  async publishRegionBoard(
    @Param("id") id: string,
    @Headers("cookie") cookie: string | undefined,
    @Headers("x-user-id") developmentUserId: string | undefined,
    @Body() body: { missionIds?: string[] },
  ): Promise<RegionAdminSummary> {
    const adminId = await this.auth.requireAdminId(cookie, developmentUserId);
    return this.missions.publishRegionBoard(id, adminId, body.missionIds);
  }

  @Patch(":id")
  async update(
    @Param("id") id: string,
    @Headers("cookie") cookie: string | undefined,
    @Headers("x-user-id") developmentUserId: string | undefined,
    @Body() body: MissionCatalogInput,
  ) {
    const adminId = await this.auth.requireAdminId(cookie, developmentUserId);
    return this.missions.update(id, body, adminId);
  }
}

function parseQuery(
  input: Record<string, string | undefined>,
): MissionCatalogQuery {
  const page = positiveInteger(input.page, 1);
  const pageSize = Math.min(positiveInteger(input.pageSize, 50), 10_000);
  const scope = oneOf(input.scope, ["COMMON", "REGION", "EVENT"] as const);
  const status = oneOf(input.status, [
    "ACTIVE",
    "INACTIVE",
    "NEEDS_REVIEW",
  ] as const);
  const kind = oneOf(input.kind, [
    "PLACE_VISIT",
    "WALK_STEPS",
    "WALK_DISTANCE",
    "QUIZ",
    "QR_SCAN",
    "PHOTO",
    "CHECK_IN",
    "COMPOSITE",
  ] as const);
  const difficulty = optionalDifficulty(input.difficulty);
  const dailyCandidate = optionalBoolean(input.dailyCandidate);
  return {
    page,
    pageSize,
    ...(input.q ? { q: input.q } : {}),
    ...(scope ? { scope } : {}),
    ...(input.regionId ? { regionId: input.regionId } : {}),
    ...(input.category ? { category: input.category } : {}),
    ...(status ? { status } : {}),
    ...(difficulty ? { difficulty } : {}),
    ...(kind ? { kind } : {}),
    ...(input.similarityGroup
      ? { similarityGroup: input.similarityGroup }
      : {}),
    ...(dailyCandidate === undefined ? {} : { dailyCandidate }),
  };
}

function optionalDifficulty(
  value: string | undefined,
): 1 | 2 | 3 | 4 | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (![1, 2, 3, 4].includes(parsed)) {
    throw new BadRequestException("Invalid difficulty filter.");
  }
  return parsed as 1 | 2 | 3 | 4;
}

function optionalBoolean(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new BadRequestException("Invalid boolean filter.");
}

function positiveInteger(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new BadRequestException(
      "Pagination values must be positive integers.",
    );
  }
  return parsed;
}

function oneOf<const T extends readonly string[]>(
  value: string | undefined,
  allowed: T,
): T[number] | undefined {
  if (value === undefined) return undefined;
  if (!allowed.includes(value)) {
    throw new BadRequestException(`Invalid filter value: ${value}`);
  }
  return value as T[number];
}
