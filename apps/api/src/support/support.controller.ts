import { Body, Controller, Get, Headers, Post } from "@nestjs/common";
import { AuthService } from "../auth/auth.service.js";
import { SupportService } from "./support.service.js";

@Controller("api/v1/support")
export class SupportController {
  constructor(private readonly support: SupportService, private readonly auth: AuthService) {}

  @Get()
  async list(@Headers("cookie") cookie?: string, @Headers("x-user-id") developmentUserId?: string): Promise<unknown> {
    return this.support.list(await this.auth.requireUserId(cookie, developmentUserId));
  }

  @Post()
  async create(
    @Body() body: { category?: string; subject?: string; detail?: string },
    @Headers("cookie") cookie?: string,
    @Headers("x-user-id") developmentUserId?: string,
  ): Promise<unknown> {
    return this.support.create(await this.auth.requireUserId(cookie, developmentUserId), body);
  }
}
