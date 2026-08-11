import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  Param,
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
}
