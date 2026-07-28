import { Module } from "@nestjs/common";

import { AuthModule } from "./auth/auth.module.js";
import { DailyModule } from "./daily/daily.module.js";
import { DatabaseModule } from "./database/database.module.js";
import { HealthModule } from "./health/health.module.js";

@Module({
  imports: [DatabaseModule, AuthModule, HealthModule, DailyModule],
})
export class AppModule {}
