import { Module } from "@nestjs/common";
import { TravelMemoryController } from "./travel-memory.controller.js";
import { TravelMemoryService } from "./travel-memory.service.js";

@Module({ controllers: [TravelMemoryController], providers: [TravelMemoryService] })
export class TravelMemoryModule {}
