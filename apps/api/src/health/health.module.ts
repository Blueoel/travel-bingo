import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import { DatabaseModule } from "../database/database.module.js";
import { AdminSystemHealthController } from "./admin-system-health.controller.js";
import { AdminSystemHealthService } from "./admin-system-health.service.js";
import { HealthController } from "./health.controller.js";

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [HealthController, AdminSystemHealthController],
  providers: [AdminSystemHealthService],
})
export class HealthModule {}
