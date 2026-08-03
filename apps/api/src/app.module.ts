import { Module } from "@nestjs/common";

import { AdminModule } from "./admin/admin.module.js";
import { AnnouncementsModule } from "./announcements/announcements.module.js";
import { AuthModule } from "./auth/auth.module.js";
import { BingoCatalogModule } from "./bingo-catalog/bingo-catalog.module.js";
import { DailyModule } from "./daily/daily.module.js";
import { DatabaseModule } from "./database/database.module.js";
import { HealthModule } from "./health/health.module.js";
import { FriendsModule } from "./friends/friends.module.js";
import { RankingModule } from "./ranking/ranking.module.js";
import { RecommendationsModule } from "./recommendations/recommendations.module.js";

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    BingoCatalogModule,
    HealthModule,
    DailyModule,
    AdminModule,
    AnnouncementsModule,
    FriendsModule,
    RankingModule,
    RecommendationsModule,
  ],
})
export class AppModule {}
