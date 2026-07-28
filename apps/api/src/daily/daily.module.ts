import { Module } from "@nestjs/common";

import { DailySessionController } from "./daily-session.controller.js";
import { DailySessionService } from "./daily-session.service.js";
import { MissionCompletionService } from "./mission-completion.service.js";

@Module({
  controllers: [DailySessionController],
  providers: [DailySessionService, MissionCompletionService],
})
export class DailyModule {}
