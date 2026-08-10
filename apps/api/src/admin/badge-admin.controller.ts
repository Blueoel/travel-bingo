import { Body, Controller, Delete, Get, Headers, Param, Patch, Post } from "@nestjs/common";
import { AuthService } from "../auth/auth.service.js";
import { BadgeAdminService, type BadgeInput } from "./badge-admin.service.js";

@Controller("api/v1/admin/badges")
export class BadgeAdminController {
  constructor(private readonly badges: BadgeAdminService, private readonly auth: AuthService) {}
  private async admin(cookie?: string, developmentUserId?: string) { await this.auth.requireAdminId(cookie, developmentUserId); }
  @Get() async list(@Headers("cookie") c?: string, @Headers("x-user-id") d?: string): Promise<unknown> { await this.admin(c, d); return this.badges.list(); }
  @Post() async create(@Body() body: BadgeInput, @Headers("cookie") c?: string, @Headers("x-user-id") d?: string): Promise<unknown> { await this.admin(c, d); return this.badges.create(body); }
  @Post("test/prepare") async prepareTest(@Body() body: { email?: string }, @Headers("cookie") c?: string, @Headers("x-user-id") d?: string): Promise<unknown> { await this.admin(c, d); return this.badges.prepareTest(body.email ?? ""); }
  @Post("test/reset") async resetTest(@Body() body: { email?: string; code?: string }, @Headers("cookie") c?: string, @Headers("x-user-id") d?: string): Promise<unknown> { await this.admin(c, d); return this.badges.resetTest(body.email ?? "", body.code ?? ""); }
  @Delete("test") async cleanupTests(@Headers("cookie") c?: string, @Headers("x-user-id") d?: string): Promise<{ deleted: number }> { await this.admin(c, d); return this.badges.cleanupTests(); }
  @Patch(":id") async update(@Param("id") id: string, @Body() body: BadgeInput, @Headers("cookie") c?: string, @Headers("x-user-id") d?: string): Promise<unknown> { await this.admin(c, d); return this.badges.update(id, body); }
}
