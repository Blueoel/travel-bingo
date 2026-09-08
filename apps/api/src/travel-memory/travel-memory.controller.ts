import { Body, Controller, Get, Headers, Param, Put } from "@nestjs/common";
import { AuthService } from "../auth/auth.service.js";
import { TravelMemoryService } from "./travel-memory.service.js";

@Controller("api/v1/travel-memories")
export class TravelMemoryController {
  constructor(private readonly memories: TravelMemoryService, private readonly auth: AuthService) {}
  @Get() async list(@Headers("cookie") cookie?: string, @Headers("x-user-id") userId?: string) {
    return this.memories.list(await this.auth.requireUserId(cookie, userId));
  }
  @Get(":regionCode") async get(@Param("regionCode") regionCode: string, @Headers("cookie") cookie?: string, @Headers("x-user-id") userId?: string) {
    return this.memories.get(await this.auth.requireUserId(cookie, userId), regionCode);
  }
  @Put(":regionCode") async save(@Param("regionCode") regionCode: string, @Body() body: unknown, @Headers("cookie") cookie?: string, @Headers("x-user-id") userId?: string) {
    return this.memories.save(await this.auth.requireUserId(cookie, userId), regionCode, body);
  }
}
