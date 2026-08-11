import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
} from "@nestjs/common";

import { AuthService } from "../auth/auth.service.js";
import { RegionRecommendationService } from "./region-recommendation.service.js";

@Controller("api/v1/recommendations")
export class RegionRecommendationController {
  constructor(
    private readonly recommendations: RegionRecommendationService,
    private readonly auth: AuthService,
  ) {}

  @Get("regions")
  recommendRegions(
    @Query("latitude") latitudeInput?: string,
    @Query("longitude") longitudeInput?: string,
    @Query("limit") limitInput?: string,
  ) {
    const hasCoordinates =
      latitudeInput !== undefined || longitudeInput !== undefined;
    const latitude = Number(latitudeInput);
    const longitude = Number(longitudeInput);
    if (
      hasCoordinates &&
      (!Number.isFinite(latitude) ||
        !Number.isFinite(longitude) ||
        latitude < -90 ||
        latitude > 90 ||
        longitude < -180 ||
        longitude > 180)
    ) {
      throw new BadRequestException(
        "Valid latitude and longitude are required.",
      );
    }
    const parsedLimit = Number(limitInput ?? 3);
    const limit =
      Number.isInteger(parsedLimit) && parsedLimit >= 1 && parsedLimit <= 10
        ? parsedLimit
        : 3;
    return this.recommendations.recommend(
      hasCoordinates ? { latitude, longitude } : null,
      limit,
    );
  }

  @Get("regions/:regionId/attractions")
  async recommendAttractions(
    @Param("regionId") regionId: string,
    @Headers("cookie") cookie: string | undefined,
    @Headers("x-user-id") developmentUserId: string | undefined,
    @Query("q") query = "",
    @Query("limit") limitInput = "12",
    @Query("contentTypeId") contentTypeIdInput = "",
    @Query("radiusKm") radiusKmInput = "20",
  ) {
    await this.auth.requireAdminId(cookie, developmentUserId);
    const parsedLimit = Number(limitInput);
    const limit =
      Number.isInteger(parsedLimit) && parsedLimit >= 1 && parsedLimit <= 30
        ? parsedLimit
        : 12;
    const parsedRadiusKm = Number(radiusKmInput);
    const radiusKm =
      Number.isFinite(parsedRadiusKm) &&
      parsedRadiusKm >= 1 &&
      parsedRadiusKm <= 20
        ? parsedRadiusKm
        : 20;
    const contentTypeId = /^\d+$/.test(contentTypeIdInput)
      ? contentTypeIdInput
      : undefined;
    return this.recommendations.searchRegionAttractions(
      regionId,
      query.trim(),
      limit,
      { ...(contentTypeId ? { contentTypeId } : {}), radiusKm },
    );
  }

  @Get("admin/regions/search")
  async searchAdministrativeRegions(
    @Headers("cookie") cookie: string | undefined,
    @Headers("x-user-id") developmentUserId: string | undefined,
    @Query("q") query = "",
    @Query("limit") limitInput = "8",
  ) {
    await this.auth.requireAdminId(cookie, developmentUserId);
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return [];
    const parsedLimit = Number(limitInput);
    const limit =
      Number.isInteger(parsedLimit) && parsedLimit >= 1 && parsedLimit <= 20
        ? parsedLimit
        : 8;
    return this.recommendations.searchAdministrativeRegions(
      trimmedQuery,
      limit,
    );
  }

  @Post("admin/regions")
  async ensureAdministrativeRegion(
    @Headers("cookie") cookie: string | undefined,
    @Headers("x-user-id") developmentUserId: string | undefined,
    @Body()
    body: {
      administrativeCode?: unknown;
      name?: unknown;
      province?: unknown;
      legalRegionCode?: unknown;
      legalSigunguCode?: unknown;
    },
  ) {
    await this.auth.requireAdminId(cookie, developmentUserId);
    const administrativeCode = requiredText(
      body.administrativeCode,
      "Administrative code",
      20,
    );
    const name = requiredText(body.name, "Region name", 80);
    const province = requiredText(body.province, "Province", 80);
    const legalRegionCode = requiredText(
      body.legalRegionCode,
      "Legal region code",
      20,
    );
    const legalSigunguCode = optionalText(body.legalSigunguCode, 20);
    if (!/^\d+$/.test(administrativeCode + legalRegionCode)) {
      throw new BadRequestException("Region codes must contain only numbers.");
    }
    if (legalSigunguCode && !/^\d+$/.test(legalSigunguCode)) {
      throw new BadRequestException("Sigungu code must contain only numbers.");
    }
    return this.recommendations.ensureAdministrativeRegion({
      administrativeCode,
      name,
      province,
      legalRegionCode,
      legalSigunguCode,
    });
  }
}

function requiredText(value: unknown, label: string, maxLength: number): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new BadRequestException(`${label} is required.`);
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    throw new BadRequestException(`${label} is too long.`);
  }
  return trimmed;
}

function optionalText(value: unknown, maxLength: number): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") {
    throw new BadRequestException("Sigungu code must be a string.");
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    throw new BadRequestException("Sigungu code is too long.");
  }
  return trimmed || null;
}
