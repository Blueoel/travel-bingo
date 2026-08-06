import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, Query } from "@nestjs/common";
import { AuthService } from "../auth/auth.service.js";
import { FriendsService } from "./friends.service.js";

@Controller("api/v1/friends")
export class FriendsController {
  constructor(private readonly friends: FriendsService, private readonly auth: AuthService) {}
  private user(cookie?: string, id?: string) { return this.auth.requireUserId(cookie, id); }
  @Get() async list(@Headers("cookie") c?: string, @Headers("x-user-id") d?: string): Promise<unknown> { return this.friends.list(await this.user(c, d)); }
  @Get("search") async search(@Query("q") q = "", @Headers("cookie") c?: string, @Headers("x-user-id") d?: string): Promise<unknown> { return this.friends.search(await this.user(c, d), q); }
  @Get(":id/profile") async profile(@Param("id") id: string, @Headers("cookie") c?: string, @Headers("x-user-id") d?: string): Promise<unknown> { return this.friends.profile(await this.user(c, d), id); }
  @Post() async request(@Body() body: { userId?: string }, @Headers("cookie") c?: string, @Headers("x-user-id") d?: string): Promise<unknown> { return this.friends.request(await this.user(c, d), body.userId ?? ""); }
  @Post(":id/block") async block(@Param("id") id: string, @Headers("cookie") c?: string, @Headers("x-user-id") d?: string): Promise<{ blocked: boolean }> { return this.friends.block(await this.user(c, d), id); }
  @Post(":id/report") async report(@Param("id") id: string, @Body() body: { reason?: string; detail?: string }, @Headers("cookie") c?: string, @Headers("x-user-id") d?: string): Promise<{ reported: boolean }> { return this.friends.report(await this.user(c, d), id, body.reason ?? "", body.detail); }
  @Patch(":id/read") async markRead(@Param("id") id: string, @Headers("cookie") c?: string, @Headers("x-user-id") d?: string): Promise<{ read: boolean }> { return this.friends.markAcceptedRead(await this.user(c, d), id); }
  @Patch(":id") async decide(@Param("id") id: string, @Body() body: { accept?: boolean }, @Headers("cookie") c?: string, @Headers("x-user-id") d?: string): Promise<unknown> { return this.friends.decide(await this.user(c, d), id, body.accept === true); }
  @Delete(":id") async remove(@Param("id") id: string, @Headers("cookie") c?: string, @Headers("x-user-id") d?: string): Promise<{ deleted: boolean }> { return this.friends.remove(await this.user(c, d), id); }
}
