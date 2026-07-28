import { Module } from "@nestjs/common";

import { MissionCatalogController } from "./mission-catalog.controller.js";
import { MissionCatalogService } from "./mission-catalog.service.js";

@Module({
  controllers: [MissionCatalogController],
  providers: [MissionCatalogService],
})
export class AdminModule {}
