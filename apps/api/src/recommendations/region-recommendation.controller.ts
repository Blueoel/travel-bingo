import { BadRequestException, Controller, Get, Query } from "@nestjs/common";

import { RegionRecommendationService } from "./region-recommendation.service.js";

@Controller("api/v1/recommendations")
export class RegionRecommendationController {
  constructor(private readonly recommendations: RegionRecommendationService) {}

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
}
