import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database/database.module.js";
import { RegionRecommendationController } from "./region-recommendation.controller.js";
import { RegionRecommendationService } from "./region-recommendation.service.js";
import { TourismSyncScheduler } from "./tourism-sync.scheduler.js";

@Module({
  imports: [DatabaseModule],
  controllers: [RegionRecommendationController],
  providers: [RegionRecommendationService, TourismSyncScheduler],
})
export class RecommendationsModule {}
