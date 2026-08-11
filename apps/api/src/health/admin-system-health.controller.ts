import { Controller, Get, Headers, Header } from "@nestjs/common";

import { AuthService } from "../auth/auth.service.js";
import {
  AdminSystemHealthService,
  type AdminSystemHealth,
} from "./admin-system-health.service.js";

@Controller("api/v1/admin/system-health")
export class AdminSystemHealthController {
  constructor(
    private readonly health: AdminSystemHealthService,
    private readonly auth: AuthService,
  ) {}

  @Get()
  @Header("cache-control", "no-store")
  async inspect(
    @Headers("cookie") cookie: string | undefined,
    @Headers("x-user-id") developmentUserId: string | undefined,
  ): Promise<AdminSystemHealth> {
    await this.auth.requireAdminId(cookie, developmentUserId);
    return this.health.inspect();
  }
}
