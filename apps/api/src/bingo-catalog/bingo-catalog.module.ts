import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import { BingoCatalogController } from "./bingo-catalog.controller.js";
import { BingoCatalogService } from "./bingo-catalog.service.js";

@Module({
  imports: [AuthModule],
  controllers: [BingoCatalogController],
  providers: [BingoCatalogService],
})
export class BingoCatalogModule {}
