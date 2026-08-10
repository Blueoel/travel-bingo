import { Module } from "@nestjs/common";

import { RankingController } from "./ranking.controller.js";
import { RankingService } from "./ranking.service.js";
import { RankingSettlementAdminController } from "./ranking-settlement-admin.controller.js";
import { RankingSettlementScheduler } from "./ranking-settlement.scheduler.js";
import { RankingSettlementService } from "./ranking-settlement.service.js";

@Module({
  controllers: [RankingController, RankingSettlementAdminController],
  providers: [RankingService, RankingSettlementService, RankingSettlementScheduler],
})
export class RankingModule {}
