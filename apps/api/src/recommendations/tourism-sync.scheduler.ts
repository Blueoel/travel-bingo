import { Injectable, Logger } from "@nestjs/common";
import type { OnModuleDestroy, OnModuleInit } from "@nestjs/common";

import { RegionRecommendationService } from "./region-recommendation.service.js";

const SYNC_INTERVAL_MS = 6 * 60 * 60_000;

@Injectable()
export class TourismSyncScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TourismSyncScheduler.name);
  private timer: NodeJS.Timeout | undefined;

  constructor(private readonly recommendations: RegionRecommendationService) {}

  onModuleInit(): void {
    if (process.env.NODE_ENV === "test") return;
    this.timer = setTimeout(() => void this.run(), 60_000);
  }

  onModuleDestroy(): void {
    if (this.timer) clearTimeout(this.timer);
  }

  private async run(): Promise<void> {
    try {
      const result = await this.recommendations.syncChangedAttractions();
      this.logger.log(
        `Tourism sync received ${result.received}, updated ${result.updated}, deactivated ${result.deactivated}.`,
      );
    } catch (error) {
      this.logger.error("Tourism data sync failed; cached data remains available.", error);
    } finally {
      this.timer = setTimeout(() => void this.run(), SYNC_INTERVAL_MS);
    }
  }
}
