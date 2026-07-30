import { Inject, Injectable } from "@nestjs/common";
import type { DatabaseClient } from "@travel-bingo/database";

import { DATABASE_CLIENT } from "../database/database.module.js";

export type BingoCatalogType = "DAILY" | "REGION" | "EVENT";
export type BingoCatalogState = "IN_PROGRESS" | "COMPLETED" | "AVAILABLE";

export interface BingoCatalogItem {
  readonly id: string;
  readonly templateId: string;
  readonly sessionId: string | null;
  readonly type: BingoCatalogType;
  readonly title: string;
  readonly regionName: string | null;
  readonly state: BingoCatalogState;
  readonly completedCellCount: number;
  readonly totalCellCount: number;
  readonly totalPoints: number;
  readonly startsAt: string | null;
  readonly endsAt: string | null;
}

@Injectable()
export class BingoCatalogService {
  constructor(
    @Inject(DATABASE_CLIENT) private readonly database: DatabaseClient,
  ) {}

  async list(userId: string, now = new Date()): Promise<BingoCatalogItem[]> {
    const [sessions, availableTemplates] = await Promise.all([
      this.database.bingoSession.findMany({
        where: { userId },
        include: {
          template: { include: { region: true } },
          cells: { select: { status: true } },
        },
        orderBy: { updatedAt: "desc" },
      }),
      this.database.bingoTemplate.findMany({
        where: {
          status: "PUBLISHED",
          region: { status: "ACTIVE" },
          type: { in: ["REGION", "EVENT"] },
          AND: [
            { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
            { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
          ],
        },
        include: {
          region: true,
          _count: { select: { cells: true } },
        },
        orderBy: [{ type: "asc" }, { publishedAt: "desc" }],
      }),
    ]);

    const sessionTemplateIds = new Set(
      sessions.map((session) => session.templateId),
    );
    const sessionItems = sessions.map((session) => {
      const completedCellCount = session.cells.filter(
        (cell) => cell.status === "VERIFIED",
      ).length;
      return {
        id: `session:${session.id}`,
        templateId: session.templateId,
        sessionId: session.id,
        type: normalizeType(session.template.type),
        title: session.template.title,
        regionName:
          normalizeType(session.template.type) === "DAILY"
            ? null
            : session.template.region.name,
        state: isCompleted(session.status) ? "COMPLETED" : "IN_PROGRESS",
        completedCellCount,
        totalCellCount: session.cells.length,
        totalPoints: session.totalPoints,
        startsAt: toIso(session.template.startsAt),
        endsAt: toIso(session.template.endsAt),
      } satisfies BingoCatalogItem;
    });
    const availableItems = availableTemplates
      .filter((template) => !sessionTemplateIds.has(template.id))
      .map(
        (template) =>
          ({
            id: `template:${template.id}`,
            templateId: template.id,
            sessionId: null,
            type: normalizeType(template.type),
            title: template.title,
            regionName: template.region.name,
            state: "AVAILABLE",
            completedCellCount: 0,
            totalCellCount: template._count.cells,
            totalPoints: 0,
            startsAt: toIso(template.startsAt),
            endsAt: toIso(template.endsAt),
          }) satisfies BingoCatalogItem,
      );

    return [...sessionItems, ...availableItems].sort(compareCatalogItems);
  }
}

function normalizeType(value: string): BingoCatalogType {
  const normalized = value.toUpperCase();
  if (normalized.includes("EVENT")) return "EVENT";
  if (normalized.includes("DAILY")) return "DAILY";
  return "REGION";
}

function isCompleted(status: string): boolean {
  return status === "CLEAR" || status === "PERFECT_CLEAR";
}

function toIso(value: Date | null): string | null {
  return value?.toISOString() ?? null;
}

function compareCatalogItems(
  left: BingoCatalogItem,
  right: BingoCatalogItem,
): number {
  const stateOrder: Record<BingoCatalogState, number> = {
    IN_PROGRESS: 0,
    AVAILABLE: 1,
    COMPLETED: 2,
  };
  const typeOrder: Record<BingoCatalogType, number> = {
    DAILY: 0,
    REGION: 1,
    EVENT: 2,
  };
  return (
    stateOrder[left.state] - stateOrder[right.state] ||
    typeOrder[left.type] - typeOrder[right.type] ||
    left.title.localeCompare(right.title, "ko")
  );
}
