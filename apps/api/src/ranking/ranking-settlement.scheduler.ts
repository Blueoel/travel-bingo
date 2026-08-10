import { Injectable, Logger } from "@nestjs/common";
import type { OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { getDailyCycle } from "../daily/daily-date.js";
import { RankingSettlementService } from "./ranking-settlement.service.js";

@Injectable()
export class RankingSettlementScheduler implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | undefined;
  private readonly logger = new Logger(RankingSettlementScheduler.name);
  constructor(private readonly settlements: RankingSettlementService) {}
  onModuleInit() { if (process.env.NODE_ENV !== "test") void this.runAndSchedule(); }
  onModuleDestroy() { if (this.timer) clearTimeout(this.timer); }
  private async runAndSchedule() {
    try { const results = await this.settlements.runDue(); if (results.length) this.logger.log(`Ranking settlements completed: ${results.map((item) => item.period).join(", ")}`); }
    catch (error) { this.logger.error("Ranking settlement failed; it will retry at the next daily boundary.", error); }
    finally { const now = new Date(), next = getDailyCycle(now).endsAt; this.timer = setTimeout(() => void this.runAndSchedule(), Math.max(1_000, next.getTime() - now.getTime() + 2_000)); }
  }
}
