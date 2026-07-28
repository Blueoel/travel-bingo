import { Module } from "@nestjs/common";

import { RankingController } from "./ranking.controller.js";
import { RankingService } from "./ranking.service.js";

@Module({
  controllers: [RankingController],
  providers: [RankingService],
})
export class RankingModule {}
