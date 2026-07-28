import { Module } from "@nestjs/common";

import { DailySessionController } from "./daily-session.controller.js";
import { DailyOperationService } from "./daily-operation.service.js";
import { DailySchedulerService } from "./daily-scheduler.service.js";
import { DailySessionService } from "./daily-session.service.js";
import { MissionCompletionService } from "./mission-completion.service.js";

@Module({
  controllers: [DailySessionController],
  providers: [
    DailySessionService,
    MissionCompletionService,
    DailyOperationService,
    DailySchedulerService,
  ],
})
export class DailyModule {}
