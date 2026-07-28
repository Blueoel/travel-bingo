import { NextResponse } from "next/server";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MIN_APPROVAL_CONFIDENCE = 0.85;
const IMAGE_PATTERN =
  /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/;

type GeminiVerdict = {
  decision: "APPROVED" | "REJECTED" | "NEEDS_REVIEW";
  targetVisible: boolean;
  confidence: number;
  evidence: string[];
  failureReasons: string[];
  retryGuide: string;
};

export async function POST(request: Request) {
  try {
    const input = (await request.json()) as Record<string, unknown>;
    const imageDataUrl =
      typeof input.imageDataUrl === "string" ? input.imageDataUrl : "";
    const match = IMAGE_PATTERN.exec(imageDataUrl);
    if (!match?.[1] || !match[2]) {
      return NextResponse.json(
        {
          code: "INVALID_IMAGE",
          message: "JPEG, PNG, WebP 사진만 사용할 수 있어요.",
        },
        { status: 400 },
      );
    }
    if (Math.floor((match[2].length * 3) / 4) > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { code: "IMAGE_TOO_LARGE", message: "사진은 8MB 이하로 선택해주세요." },
        { status: 400 },
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          code: "AI_NOT_CONFIGURED",
          message: "사진 AI 인증이 아직 설정되지 않았어요.",
        },
        { status: 503 },
      );
    }
    const model = process.env.GEMINI_VISION_MODEL ?? "gemini-3.5-flash-lite";
    const title = safeText(input.title, 80, "사진 미션");
    const description = safeText(input.description, 500, "");
    const verificationLabel = safeText(input.verificationLabel, 80, "사진 1장");
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: [
                    "당신은 Travel Bingo 사진 미션 검수자입니다.",
                    "미션의 핵심 대상이 사진에 실제로 명확하게 보여야 합니다.",
                    "제목이나 설명과 무관한 사진은 반드시 REJECTED로 판정하세요.",
                    "사진에서 직접 확인할 수 있는 사실만 근거로 판단하고 추측하지 마세요.",
                    "핵심 대상이 명확히 보이고 조건을 충족할 때만 targetVisible=true와 APPROVED를 함께 반환하세요.",
                    "핵심 대상이 없으면 targetVisible=false와 REJECTED를 반환하세요.",
                    "흐림·가림·주관성 때문에 확신하기 어렵다면 NEEDS_REVIEW를 선택하세요.",
                    `미션명: ${title}`,
                    `설명: ${description}`,
                    `필요 사진: ${verificationLabel}`,
                    "evidence에는 사진에서 확인한 근거만 작성하세요.",
                    "retryGuide는 재촬영에 필요한 짧은 한국어 안내이며 필요 없으면 빈 문자열입니다.",
                  ].join("\n"),
                },
                { inlineData: { mimeType: match[1], data: match[2] } },
              ],
            },
          ],
          generationConfig: {
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
    const payload = (await response.json()) as Record<string, unknown>;
    if (!response.ok) {
      return NextResponse.json(
        {
          code: "AI_PROVIDER_ERROR",
          message: "AI 사진 판정을 완료하지 못했어요.",
        },
        { status: 502 },
      );
    }
    const candidate = asRecord(asArray(payload.candidates)[0]);
    if (candidate?.finishReason === "SAFETY") {
      return NextResponse.json(
        { code: "UNSAFE_IMAGE", message: "이 사진은 인증에 사용할 수 없어요." },
        { status: 400 },
      );
    }
    const content = asRecord(candidate?.content);
    const part = asRecord(asArray(content?.parts)[0]);
    const verdict = enforceApprovalPolicy(parseVerdict(part?.text));
    return NextResponse.json({ ...verdict, model });
  } catch {
    return NextResponse.json(
      {
        code: "AI_VERIFICATION_FAILED",
        message: "사진 인증 중 오류가 발생했어요.",
      },
      { status: 500 },
    );
  }
}

function parseVerdict(value: unknown): GeminiVerdict {
  if (typeof value !== "string") throw new Error("Missing Gemini output");
  const parsed = JSON.parse(value) as Record<string, unknown>;
  if (
    !["APPROVED", "REJECTED", "NEEDS_REVIEW"].includes(
      String(parsed.decision),
    ) ||
    typeof parsed.targetVisible !== "boolean" ||
    typeof parsed.confidence !== "number"
  ) {
    throw new Error("Invalid Gemini output");
  }
  return {
    decision: parsed.decision as GeminiVerdict["decision"],
    targetVisible: parsed.targetVisible,
    confidence: Math.max(0, Math.min(1, parsed.confidence)),
    evidence: stringArray(parsed.evidence),
    failureReasons: stringArray(parsed.failureReasons),
    retryGuide: typeof parsed.retryGuide === "string" ? parsed.retryGuide : "",
  };
}

function enforceApprovalPolicy(verdict: GeminiVerdict): GeminiVerdict {
  if (!verdict.targetVisible) {
    return {
      ...verdict,
      decision: "REJECTED",
      retryGuide:
        verdict.retryGuide ||
        "미션 대상이 사진에 보이지 않아요. 대상이 분명하게 나오도록 다시 촬영해 주세요.",
    };
  }

  const safelyApproved =
    verdict.decision === "APPROVED" &&
    verdict.targetVisible &&
    verdict.confidence >= MIN_APPROVAL_CONFIDENCE &&
    verdict.evidence.length > 0;

  if (safelyApproved || verdict.decision === "REJECTED") return verdict;

  return {
    ...verdict,
    decision: "NEEDS_REVIEW",
    retryGuide:
      verdict.retryGuide ||
      "미션 대상이 사진에 더 크고 선명하게 보이도록 다시 촬영해 주세요.",
  };
}

function safeText(
  value: unknown,
  maximumLength: number,
  fallback: string,
): string {
  return typeof value === "string"
    ? value.trim().slice(0, maximumLength) || fallback
    : fallback;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .slice(0, 4)
    : [];
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}
