import { Module } from "@nestjs/common";

import { AdminModule } from "./admin/admin.module.js";
import { AuthModule } from "./auth/auth.module.js";
import { DailyModule } from "./daily/daily.module.js";
import { DatabaseModule } from "./database/database.module.js";
import { HealthModule } from "./health/health.module.js";
import { RankingModule } from "./ranking/ranking.module.js";
import { RecommendationsModule } from "./recommendations/recommendations.module.js";

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    HealthModule,
    DailyModule,
    AdminModule,
    RankingModule,
    RecommendationsModule,
  ],
})
export class AppModule {}
