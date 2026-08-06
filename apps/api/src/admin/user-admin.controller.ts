import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Query,
} from "@nestjs/common";

import { AuthService } from "../auth/auth.service.js";
import {
  UserAdminService,
  type UserAdminMutation,
  type UserAdminRecord,
} from "./user-admin.service.js";

@Controller("api/v1/admin/users")
export class UserAdminController {
  constructor(
    private readonly users: UserAdminService,
    private readonly auth: AuthService,
  ) {}

  @Get()
  async list(
    @Headers("cookie") cookie: string | undefined,
    @Headers("x-user-id") developmentUserId: string | undefined,
    @Query("q") q?: string,
    @Query("status") status?: string,
  ): Promise<{
    readonly items: UserAdminRecord[];
    readonly summary: {
      readonly total: number;
      readonly active: number;
      readonly suspended: number;
      readonly deleted: number;
    };
  }> {
    await this.auth.requireAdminId(cookie, developmentUserId);
    return this.users.list({
      ...(q ? { q } : {}),
      ...(status ? { status } : {}),
    });
  }

  @Patch(":id/status")
  async updateStatus(
    @Headers("cookie") cookie: string | undefined,
    @Headers("x-user-id") developmentUserId: string | undefined,
    @Param("id") id: string,
    @Body() body: { action?: "SUSPEND" | "ACTIVATE" | "WITHDRAW" },
  ): Promise<UserAdminMutation> {
    const administratorId = await this.auth.requireAdminId(
      cookie,
      developmentUserId,
    );
    return this.users.updateStatus(
      id,
      body.action ?? ("" as "SUSPEND"),
      administratorId,
    );
  }

  @Get("reports/list")
  async reports(@Headers("cookie") cookie?: string, @Headers("x-user-id") developmentUserId?: string, @Query("status") status?: string): Promise<unknown> {
    await this.auth.requireAdminId(cookie, developmentUserId);
    return this.users.listReports(status);
  }

  @Patch("reports/:id")
  async resolveReport(@Headers("cookie") cookie: string | undefined, @Headers("x-user-id") developmentUserId: string | undefined, @Param("id") id: string, @Body() body: { status?: "RESOLVED" | "DISMISSED" }): Promise<unknown> {
    await this.auth.requireAdminId(cookie, developmentUserId);
    return this.users.resolveReport(id, body.status ?? "RESOLVED");
  }
}
