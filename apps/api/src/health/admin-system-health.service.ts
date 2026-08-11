import { Inject, Injectable } from "@nestjs/common";
import {
  DAILY_LUCKY_CHANCE_PERCENT,
  BOARD_CELL_COUNT,
} from "@travel-bingo/domain";
import type { DatabaseClient } from "@travel-bingo/database";

import { DATABASE_CLIENT } from "../database/database.module.js";

const KTO_HEALTH_URL = "https://apis.data.go.kr/B551011/KorService2/lDongCode2";
const EXTERNAL_TIMEOUT_MS = 5_000;

type HealthStatus = "HEALTHY" | "WARNING" | "ERROR" | "NOT_CONFIGURED";

interface ComponentHealth {
  readonly key: string;
  readonly label: string;
  readonly status: HealthStatus;
  readonly summary: string;
  readonly latencyMs: number | null;
}

export interface AdminSystemHealth {
  readonly status: "HEALTHY" | "WARNING" | "ERROR";
  readonly checkedAt: string;
  readonly components: readonly ComponentHealth[];
  readonly content: {
    readonly dailyCandidateCount: number;
    readonly dailyReady: boolean;
    readonly activeRegionCount: number;
    readonly readyRegionCount: number;
    readonly regionsNeedingMissions: readonly {
      readonly id: string;
      readonly name: string;
      readonly activeMissionCount: number;
      readonly missingMissionCount: number;
    }[];
    readonly pendingPhotoReviewCount: number;
    readonly pendingOutboxCount: number;
    readonly luckyChancePercent: number;
    readonly luckyPoints: number;
  };
  readonly operations: {
    readonly daily: OperationSummary | null;
    readonly settlements: readonly SettlementSummary[];
  };
  readonly recentErrors: readonly RecentError[];
  readonly warnings: readonly string[];
}

interface OperationSummary {
  readonly status: string;
  readonly label: string;
  readonly startedAt: string;
  readonly completedAt: string | null;
  readonly lastError: string | null;
}

interface SettlementSummary extends OperationSummary {
  readonly period: string;
}

interface RecentError {
  readonly source: string;
  readonly message: string;
  readonly occurredAt: string;
}

@Injectable()
export class AdminSystemHealthService {
  constructor(
    @Inject(DATABASE_CLIENT) private readonly database: DatabaseClient,
  ) {}

  async inspect(): Promise<AdminSystemHealth> {
    const checkedAt = new Date();
    const apiComponent: ComponentHealth = {
      key: "api",
      label: "API 서버",
      status: "HEALTHY",
      summary: "관리자 진단 요청을 정상 처리했습니다.",
      latencyMs: null,
    };
    const databaseComponent = await this.checkDatabase();
    const [geminiComponent, ktoComponent] = await Promise.all([
      this.checkGemini(),
      this.checkKto(),
    ]);
    const components = [
      apiComponent,
      databaseComponent,
      geminiComponent,
      ktoComponent,
    ];

    const databaseData =
      databaseComponent.status === "HEALTHY"
        ? await this.loadDatabaseDiagnostics()
        : emptyDatabaseDiagnostics();
    const warnings = [...databaseData.warnings];
    for (const component of components) {
      if (component.status !== "HEALTHY") {
        warnings.push(`${component.label}: ${component.summary}`);
      }
    }
    const status = components.some((item) => item.status === "ERROR")
      ? "ERROR"
      : warnings.length > 0
        ? "WARNING"
        : "HEALTHY";

    return {
      status,
      checkedAt: checkedAt.toISOString(),
      components,
      content: databaseData.content,
      operations: databaseData.operations,
      recentErrors: databaseData.recentErrors,
      warnings,
    };
  }

  private async checkDatabase(): Promise<ComponentHealth> {
    const startedAt = Date.now();
    try {
      await this.database.$queryRaw`SELECT 1`;
      return {
        key: "database",
        label: "Neon 데이터베이스",
        status: "HEALTHY",
        summary: "연결과 읽기 요청이 정상입니다.",
        latencyMs: Date.now() - startedAt,
      };
    } catch {
      return {
        key: "database",
        label: "Neon 데이터베이스",
        status: "ERROR",
        summary: "데이터베이스 연결을 확인할 수 없습니다.",
        latencyMs: Date.now() - startedAt,
      };
    }
  }

  private async checkGemini(): Promise<ComponentHealth> {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    const model =
      process.env.GEMINI_VISION_MODEL?.trim() || "gemini-3.5-flash-lite";
    if (!apiKey) {
      return notConfigured(
        "gemini",
        "Gemini 사진 인증",
        "GEMINI_API_KEY가 설정되지 않았습니다.",
      );
    }
    const startedAt = Date.now();
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}`,
        {
          headers: { "x-goog-api-key": apiKey },
          signal: AbortSignal.timeout(EXTERNAL_TIMEOUT_MS),
        },
      );
      return externalResult(
        "gemini",
        "Gemini 사진 인증",
        response,
        Date.now() - startedAt,
        response.ok
          ? `${model} 모델을 사용할 수 있습니다.`
          : "API 키 또는 모델 설정을 확인해주세요.",
      );
    } catch {
      return unavailable("gemini", "Gemini 사진 인증", Date.now() - startedAt);
    }
  }

  private async checkKto(): Promise<ComponentHealth> {
    const apiKey = process.env.KTO_API_KEY?.trim();
    if (!apiKey) {
      return notConfigured(
        "kto",
        "한국관광공사 Open API",
        "KTO_API_KEY가 설정되지 않았습니다.",
      );
    }
    const startedAt = Date.now();
    try {
      const parameters = new URLSearchParams({
        serviceKey: normalizeServiceKey(apiKey),
        pageNo: "1",
        numOfRows: "1",
        MobileOS: "ETC",
        MobileApp: "TravelBingo",
        _type: "json",
      });
      const response = await fetch(`${KTO_HEALTH_URL}?${parameters}`, {
        signal: AbortSignal.timeout(EXTERNAL_TIMEOUT_MS),
      });
      const body = await response.text();
      const validResponse =
        response.ok &&
        (/"resultCode"\s*:\s*"?0000"?/.test(body) ||
          /<resultCode>0000<\/resultCode>/.test(body));
      return externalResult(
        "kto",
        "한국관광공사 Open API",
        { ok: validResponse, status: response.status },
        Date.now() - startedAt,
        validResponse
          ? "국문 관광정보 서비스에 연결되었습니다."
          : "일반 인증키 또는 활용 상태를 확인해주세요.",
      );
    } catch {
      return unavailable(
        "kto",
        "한국관광공사 Open API",
        Date.now() - startedAt,
      );
    }
  }

  private async loadDatabaseDiagnostics() {
    try {
      const [
        dailyCollection,
        regionRows,
        pendingPhotoReviewCount,
        pendingOutboxCount,
        daily,
        settlements,
        outboxErrors,
      ] = await Promise.all([
        this.database.missionCollection.findFirst({
          where: { type: "DAILY", regionId: null, status: "ACTIVE" },
          select: {
            items: {
              where: { mission: { scope: "COMMON", status: "ACTIVE" } },
              select: { missionId: true },
            },
          },
        }),
        this.database.region.findMany({
          where: { status: "ACTIVE" },
          orderBy: { name: "asc" },
          select: {
            id: true,
            name: true,
            missionLinks: {
              where: { mission: { scope: "REGION", status: "ACTIVE" } },
              select: { missionId: true },
            },
          },
        }),
        this.database.verification.count({
          where: {
            type: "PHOTO",
            status: { in: ["PENDING", "NEEDS_REVIEW"] },
          },
        }),
        this.database.outboxEvent.count({ where: { processedAt: null } }),
        this.database.dailyOperation.findFirst({
          orderBy: { cycleDate: "desc" },
        }),
        this.database.rankingSettlement.findMany({
          orderBy: { periodEnd: "desc" },
          take: 3,
        }),
        this.database.outboxEvent.findMany({
          where: { lastError: { not: null } },
          orderBy: { occurredAt: "desc" },
          take: 5,
          select: { lastError: true, occurredAt: true, topic: true },
        }),
      ]);

      const dailyCandidateCount = dailyCollection?.items.length ?? 0;
      const regionsNeedingMissions = regionRows
        .filter((region) => region.missionLinks.length < BOARD_CELL_COUNT)
        .map((region) => ({
          id: region.id,
          name: region.name,
          activeMissionCount: region.missionLinks.length,
          missingMissionCount: BOARD_CELL_COUNT - region.missionLinks.length,
        }));
      const warnings: string[] = [];
      if (dailyCandidateCount < BOARD_CELL_COUNT) {
        warnings.push(
          `Daily 활성 후보가 ${dailyCandidateCount}개입니다. 최소 ${BOARD_CELL_COUNT}개가 필요합니다.`,
        );
      }
      if (regionsNeedingMissions.length > 0) {
        warnings.push(
          `활성 지역 ${regionsNeedingMissions.length}곳은 지역 미션이 부족합니다.`,
        );
      }
      if (pendingPhotoReviewCount > 0) {
        warnings.push(
          `사진 검수 ${pendingPhotoReviewCount}건이 대기 중입니다.`,
        );
      }
      if (pendingOutboxCount > 0) {
        warnings.push(
          `알림·후속 처리 ${pendingOutboxCount}건이 대기 중입니다.`,
        );
      }
      if (daily?.status === "FAILED") {
        warnings.push("최근 Daily 자동 작업이 실패했습니다.");
      }
      if (settlements.some((item) => item.status === "FAILED")) {
        warnings.push("최근 랭킹 정산 중 실패 기록이 있습니다.");
      }

      const recentErrors: RecentError[] = [
        ...(daily?.lastError
          ? [
              {
                source: "Daily 자동 작업",
                message: daily.lastError,
                occurredAt: daily.startedAt.toISOString(),
              },
            ]
          : []),
        ...settlements
          .filter((item) => item.lastError)
          .map((item) => ({
            source: `${item.period} 랭킹 정산`,
            message: item.lastError ?? "알 수 없는 오류",
            occurredAt: item.startedAt.toISOString(),
          })),
        ...outboxErrors.map((item) => ({
          source: `후속 처리 · ${item.topic}`,
          message: item.lastError ?? "알 수 없는 오류",
          occurredAt: item.occurredAt.toISOString(),
        })),
      ]
        .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
        .slice(0, 8);

      return {
        content: {
          dailyCandidateCount,
          dailyReady: dailyCandidateCount >= BOARD_CELL_COUNT,
          activeRegionCount: regionRows.length,
          readyRegionCount: regionRows.length - regionsNeedingMissions.length,
          regionsNeedingMissions,
          pendingPhotoReviewCount,
          pendingOutboxCount,
          luckyChancePercent: DAILY_LUCKY_CHANCE_PERCENT,
          luckyPoints: 50,
        },
        operations: {
          daily: daily
            ? {
                status: daily.status,
                label: daily.cycleDate.toISOString().slice(0, 10),
                startedAt: daily.startedAt.toISOString(),
                completedAt: daily.completedAt?.toISOString() ?? null,
                lastError: daily.lastError,
              }
            : null,
          settlements: settlements.map((item) => ({
            period: item.period,
            status: item.status,
            label: `${item.periodStart.toISOString()} ~ ${item.periodEnd.toISOString()}`,
            startedAt: item.startedAt.toISOString(),
            completedAt: item.completedAt?.toISOString() ?? null,
            lastError: item.lastError,
          })),
        },
        recentErrors,
        warnings,
      };
    } catch {
      return {
        ...emptyDatabaseDiagnostics(),
        warnings: ["콘텐츠와 자동 작업 상세 정보를 불러오지 못했습니다."],
      };
    }
  }
}

function emptyDatabaseDiagnostics() {
  return {
    content: {
      dailyCandidateCount: 0,
      dailyReady: false,
      activeRegionCount: 0,
      readyRegionCount: 0,
      regionsNeedingMissions: [],
      pendingPhotoReviewCount: 0,
      pendingOutboxCount: 0,
      luckyChancePercent: DAILY_LUCKY_CHANCE_PERCENT,
      luckyPoints: 50,
    },
    operations: { daily: null, settlements: [] },
    recentErrors: [],
    warnings: [],
  };
}

function notConfigured(
  key: string,
  label: string,
  summary: string,
): ComponentHealth {
  return { key, label, status: "NOT_CONFIGURED", summary, latencyMs: null };
}

function unavailable(
  key: string,
  label: string,
  latencyMs: number,
): ComponentHealth {
  return {
    key,
    label,
    status: "WARNING",
    summary: "응답 시간이 초과되었거나 일시적으로 연결할 수 없습니다.",
    latencyMs,
  };
}

function externalResult(
  key: string,
  label: string,
  response: Pick<Response, "ok" | "status">,
  latencyMs: number,
  summary: string,
): ComponentHealth {
  return {
    key,
    label,
    status: response.ok
      ? "HEALTHY"
      : [400, 401, 403].includes(response.status)
        ? "ERROR"
        : "WARNING",
    summary,
    latencyMs,
  };
}

function normalizeServiceKey(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
