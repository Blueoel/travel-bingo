import { Module } from "@nestjs/common";

import { MissionCatalogController } from "./mission-catalog.controller.js";
import { MissionCatalogService } from "./mission-catalog.service.js";
import { UserAdminController } from "./user-admin.controller.js";
import { UserAdminService } from "./user-admin.service.js";
import { BadgeAdminController } from "./badge-admin.controller.js";
import { BadgeAdminService } from "./badge-admin.service.js";

@Module({
  controllers: [MissionCatalogController, UserAdminController, BadgeAdminController],
  providers: [MissionCatalogService, UserAdminService, BadgeAdminService],
})
export class AdminModule {}
