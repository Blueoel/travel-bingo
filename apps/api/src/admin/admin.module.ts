import { Module } from "@nestjs/common";

import { MissionCatalogController } from "./mission-catalog.controller.js";
import { MissionCatalogService } from "./mission-catalog.service.js";
import { UserAdminController } from "./user-admin.controller.js";
import { UserAdminService } from "./user-admin.service.js";

@Module({
  controllers: [MissionCatalogController, UserAdminController],
  providers: [MissionCatalogService, UserAdminService],
})
export class AdminModule {}
