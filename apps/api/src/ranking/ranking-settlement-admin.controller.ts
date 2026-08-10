import { Controller, Get, Headers, Post } from "@nestjs/common";
import { AuthService } from "../auth/auth.service.js";
import { RankingSettlementService } from "./ranking-settlement.service.js";

@Controller("api/v1/admin/ranking-settlements")
export class RankingSettlementAdminController {
  constructor(private readonly settlements: RankingSettlementService, private readonly auth: AuthService) {}
  private async admin(cookie?: string, developmentUserId?: string) { await this.auth.requireAdminId(cookie, developmentUserId); }
  @Get() async recent(@Headers("cookie") c?: string, @Headers("x-user-id") d?: string) { await this.admin(c, d); return this.settlements.recent(); }
  @Post("run") async run(@Headers("cookie") c?: string, @Headers("x-user-id") d?: string) { await this.admin(c, d); return this.settlements.runDue(); }
}
