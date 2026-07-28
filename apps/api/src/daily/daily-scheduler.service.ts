import { Injectable, Logger } from "@nestjs/common";
import type { OnModuleDestroy, OnModuleInit } from "@nestjs/common";

import { getDailyCycle } from "./daily-date.js";
import { DailyOperationService } from "./daily-operation.service.js";

@Injectable()
export class DailySchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DailySchedulerService.name);
  private timer: NodeJS.Timeout | undefined;

  constructor(private readonly operations: DailyOperationService) {}

  onModuleInit(): void {
    if (process.env.NODE_ENV === "test") return;
    void this.runAndSchedule();
  }

  onModuleDestroy(): void {
    if (this.timer) clearTimeout(this.timer);
  }

  private async runAndSchedule(): Promise<void> {
    try {
      const result = await this.operations.runDue();
      this.logger.log(
        `Daily operation ${result.date}: ${result.skipped ? "already complete" : "completed"}`,
      );
    } catch (error) {
      this.logger.error("Daily operation failed; it will retry at the next boundary.", error);
    } finally {
      const now = new Date();
      const next = getDailyCycle(now).endsAt;
      this.timer = setTimeout(
        () => void this.runAndSchedule(),
        Math.max(1_000, next.getTime() - now.getTime() + 1_000),
      );
    }
  }
}
