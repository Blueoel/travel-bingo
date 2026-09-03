import {
  BadGatewayException,
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import type { DatabaseClient } from "@travel-bingo/database";

import { DATABASE_CLIENT } from "../database/database.module.js";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MIN_APPROVAL_CONFIDENCE = 0.85;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export interface PhotoAnalysis {
  readonly decision: "APPROVED" | "REJECTED" | "NEEDS_REVIEW";
  readonly targetVisible: boolean;
  readonly confidence: number;
  readonly evidence: readonly string[];
  readonly failureReasons: readonly string[];
  readonly retryGuide: string | null;
  readonly model: string;
}

@Injectable()
export class PhotoVerificationService {
  constructor(
    @Inject(DATABASE_CLIENT) private readonly database: DatabaseClient,
  ) {}

  async analyze(command: {
    readonly userId: string;
    readonly sessionId: string;
    readonly cellId: string;
    readonly imageDataUrl: string;
  }): Promise<PhotoAnalysis> {
    validateImageDataUrl(command.imageDataUrl);
    const cell = await this.database.sessionCell.findFirst({
      where: {
        id: command.cellId,
        sessionId: command.sessionId,
        session: {
          userId: command.userId,
          status: { in: ["ACTIVE", "CLEAR"] },
        },
      },
      select: { missionSnapshot: true },
    });
    if (!cell)
      throw new NotFoundException("The active photo mission was not found.");

    const mission = asRecord(cell.missionSnapshot);
    if (mission?.kind !== "PHOTO") {
      throw new BadRequestException(
        "This mission does not support photo verification.",
      );
    }

    const verificationPolicy = asRecord(mission.verificationPolicy);
    if (!requiresAiJudgement(verificationPolicy)) {
      return {
        decision: "APPROVED",
        targetVisible: true,
        confidence: 1,
        evidence: ["자유 기록형 사진 미션 제출"],
        failureReasons: [],
        retryGuide: null,
        model: "record-only",
      };
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new ServiceUnavailableException({
        code: "AI_NOT_CONFIGURED",
        message: "Photo AI verification is not configured.",
      });
    }

    const model = process.env.GEMINI_VISION_MODEL ?? "gemini-2.5-flash-lite";
    const image = splitImageDataUrl(command.imageDataUrl);
    let response: Response;
    try {
      response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "x-goog-api-key": apiKey,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: buildPrompt({
                    title: String(mission.title ?? "사진 미션"),
                    description: String(mission.description ?? ""),
                    targetValue: mission.targetValue,
                    verificationPolicy: mission.verificationPolicy,
                  }),
                },
                { inlineData: { mimeType: image.mimeType, data: image.data } },
              ],
            },
          ],
          generationConfig: {
            temperature: 0,
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                decision: {
                  type: "STRING",
                  enum: ["APPROVED", "REJECTED", "NEEDS_REVIEW"],
                },
                targetVisible: { type: "BOOLEAN" },
                confidence: { type: "NUMBER" },
                evidence: { type: "ARRAY", items: { type: "STRING" } },
                failureReasons: { type: "ARRAY", items: { type: "STRING" } },
                retryGuide: { type: "STRING" },
              },
              required: [
                "decision",
                "targetVisible",
                "confidence",
                "evidence",
                "failureReasons",
                "retryGuide",
              ],
            },
          },
        }),
        signal: AbortSignal.timeout(25_000),
      },
      );
    } catch {
      return providerReviewFallback(model);
    }
    if (!response.ok) {
      return providerReviewFallback(model);
    }
    const payload = (await response.json()) as unknown;
    try {
      return enforceApprovalPolicy(
        parseAnalysis(extractGeminiText(payload), model),
        verificationPolicy,
      );
    } catch {
      return providerReviewFallback(model);
    }
  }
}

function providerReviewFallback(model: string): PhotoAnalysis {
  return {
    decision: "NEEDS_REVIEW",
    targetVisible: false,
    confidence: 0,
    evidence: [],
    failureReasons: ["AI 자동 판정을 완료하지 못했습니다."],
    retryGuide: "사진은 관리자 검수 대기로 접수됩니다.",
    model,
  };
}

function requiresAiJudgement(
  policy: Record<string, unknown> | null,
): boolean {
  if (policy?.photoVerificationMode === "RECORD") return false;
  if (policy?.photoVerificationMode === "AI") return true;
  return Boolean(
    policy?.requiredSubject ||
      policy?.requiredColor ||
      policy?.requiredObjects ||
      policy?.requiredText,
  );
}

function extractGeminiText(payload: unknown): string {
  const record = asRecord(payload);
  const candidates = Array.isArray(record?.candidates) ? record.candidates : [];
  const candidate = asRecord(candidates[0]);
  if (candidate?.finishReason === "SAFETY") {
    throw new BadRequestException({
      code: "UNSAFE_IMAGE",
      message: "The submitted image cannot be used for mission verification.",
    });
  }
  const content = asRecord(candidate?.content);
  const parts = Array.isArray(content?.parts) ? content.parts : [];
  const text = asRecord(parts[0])?.text;
  if (typeof text === "string") return text;
  throw new BadGatewayException(
    "The photo AI provider returned an invalid response.",
  );
}

function buildPrompt(mission: {
  readonly title: string;
  readonly description: string;
  readonly targetValue: unknown;
  readonly verificationPolicy: unknown;
}): string {
  return [
    "당신은 Travel Bingo 사진 미션의 검수자입니다.",
    "미션의 핵심 대상이 사진에 실제로 명확하게 보여야 합니다.",
    "제목이나 설명과 무관한 사진은 반드시 REJECTED로 판정하세요.",
    "사진에 직접 보이는 사실만 근거로 판단하세요. 추측하지 마세요.",
    "핵심 대상이 명확히 보이고 조건을 충족할 때만 targetVisible=true와 APPROVED를 함께 반환하세요.",
    "핵심 대상이 없으면 targetVisible=false와 REJECTED를 반환하세요.",
    "가림·흐림·주관성 때문에 확신하기 어렵다면 NEEDS_REVIEW를 선택하세요.",
    `미션명: ${mission.title}`,
    `설명: ${mission.description}`,
    `목표 수치: ${String(mission.targetValue ?? "1")}`,
    `추가 정책: ${JSON.stringify(mission.verificationPolicy ?? {})}`,
    "evidence에는 사진에서 확인한 근거만, failureReasons에는 미충족 근거만 작성하세요.",
    "retryGuide는 사용자가 재촬영할 때 필요한 짧은 한국어 안내로 작성하세요.",
  ].join("\n");
}

function validateImageDataUrl(value: string): void {
  const match =
    /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(value);
  if (!match || !ALLOWED_IMAGE_TYPES.has(match[1] ?? "")) {
    throw new BadRequestException("JPEG, PNG, or WebP image data is required.");
  }
  const estimatedBytes = Math.floor(((match[2]?.length ?? 0) * 3) / 4);
  if (estimatedBytes < 1 || estimatedBytes > MAX_IMAGE_BYTES) {
    throw new BadRequestException("The image must be no larger than 8 MB.");
  }
}

function splitImageDataUrl(value: string): { mimeType: string; data: string } {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(value);
  if (!match?.[1] || !match[2]) {
    throw new BadRequestException("The image data is invalid.");
  }
  return { mimeType: match[1], data: match[2] };
}

function parseAnalysis(text: string, model: string): PhotoAnalysis {
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    const decision = parsed.decision;
    const targetVisible = parsed.targetVisible;
    const confidence = parsed.confidence;
    if (
      !["APPROVED", "REJECTED", "NEEDS_REVIEW"].includes(String(decision)) ||
      typeof targetVisible !== "boolean" ||
      typeof confidence !== "number"
    ) {
      throw new Error("Invalid verdict");
    }
    return {
      decision: decision as PhotoAnalysis["decision"],
      targetVisible,
      confidence: Math.max(0, Math.min(1, confidence)),
      evidence: stringArray(parsed.evidence),
      failureReasons: stringArray(parsed.failureReasons),
      retryGuide:
        typeof parsed.retryGuide === "string" && parsed.retryGuide.trim()
          ? parsed.retryGuide
          : null,
      model,
    };
  } catch {
    throw new BadGatewayException("The photo AI verdict could not be parsed.");
  }
}

function enforceApprovalPolicy(
  analysis: PhotoAnalysis,
  policy: Record<string, unknown> | null,
): PhotoAnalysis {
  if (!analysis.targetVisible) {
    const hasObjectiveRule = Boolean(
      policy?.requiredSubject ||
        policy?.requiredColor ||
        policy?.requiredObjects ||
        policy?.requiredText,
    );
    return {
      ...analysis,
      decision: hasObjectiveRule ? "REJECTED" : "NEEDS_REVIEW",
      retryGuide:
        analysis.retryGuide ??
        (hasObjectiveRule
          ? "미션 대상이 사진에 보이지 않아요. 대상이 분명하게 나오도록 다시 촬영해 주세요."
          : "정답이 정해지지 않은 사진이라 관리자가 직접 확인할 예정이에요."),
    };
  }

  const safelyApproved =
    analysis.decision === "APPROVED" &&
    analysis.targetVisible &&
    analysis.confidence >= MIN_APPROVAL_CONFIDENCE &&
    analysis.evidence.length > 0;

  if (safelyApproved || analysis.decision === "REJECTED") return analysis;

  return {
    ...analysis,
    decision: "NEEDS_REVIEW",
    retryGuide:
      analysis.retryGuide ??
      "미션 대상이 사진에 더 크고 선명하게 보이도록 다시 촬영해 주세요.",
  };
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .slice(0, 4)
    : [];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}
