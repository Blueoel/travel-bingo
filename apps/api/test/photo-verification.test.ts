import {
  BadRequestException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PhotoVerificationService } from "../src/daily/photo-verification.service.js";

const image = `data:image/jpeg;base64,${Buffer.from("test-image").toString("base64")}`;
const database = {
  sessionCell: {
    findFirst: vi.fn(async () => ({
      missionSnapshot: {
        kind: "PHOTO",
        title: "신호등 찾기",
        description: "교차로의 신호등을 촬영하세요.",
        targetValue: "1",
        verificationPolicy: {
          type: "PHOTO",
          requiredSubject: "TRAFFIC_LIGHT",
        },
      },
    })),
  },
};

describe("PhotoVerificationService", () => {
  afterEach(() => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_VISION_MODEL;
    vi.restoreAllMocks();
  });

  it("rejects unsupported image data before calling AI", async () => {
    const service = new PhotoVerificationService(database as never);
    await expect(
      service.analyze({
        userId: "user",
        sessionId: "session",
        cellId: "cell",
        imageDataUrl: "data:text/plain;base64,dGVzdA==",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("does not silently approve when the API key is missing", async () => {
    const service = new PhotoVerificationService(database as never);
    await expect(
      service.analyze({
        userId: "user",
        sessionId: "session",
        cellId: "cell",
        imageDataUrl: image,
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it("accepts a free-form record photo without calling AI", async () => {
    database.sessionCell.findFirst.mockResolvedValueOnce({
      missionSnapshot: {
        kind: "PHOTO",
        title: "오늘의 동네 한 장",
        description: "오늘 기억하고 싶은 동네 풍경을 남겨보세요.",
        verificationPolicy: {
          type: "PHOTO",
          photoVerificationMode: "RECORD",
        },
      },
    } as never);
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const service = new PhotoVerificationService(database as never);
    const result = await service.analyze({
      userId: "user",
      sessionId: "session",
      cellId: "cell",
      imageDataUrl: image,
    });

    expect(result.decision).toBe("APPROVED");
    expect(result.model).toBe("record-only");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns a structured verdict from the Gemini vision check", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            candidates: [
              {
                finishReason: "STOP",
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        decision: "APPROVED",
                        targetVisible: true,
                        confidence: 0.94,
                        evidence: ["교차로 신호등이 선명하게 보임"],
                        failureReasons: [],
                        retryGuide: "",
                      }),
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200 },
        ),
      ),
    );

    const service = new PhotoVerificationService(database as never);
    const result = await service.analyze({
      userId: "user",
      sessionId: "session",
      cellId: "cell",
      imageDataUrl: image,
    });

    expect(result.decision).toBe("APPROVED");
    expect(result.confidence).toBe(0.94);
    expect(result.model).toBe("gemini-3.5-flash-lite");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("does not approve when Gemini cannot see the required mission target", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            candidates: [
              {
                finishReason: "STOP",
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        decision: "APPROVED",
                        targetVisible: false,
                        confidence: 0.99,
                        evidence: ["공원 벤치만 보임"],
                        failureReasons: ["신호등이 보이지 않음"],
                        retryGuide: "",
                      }),
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200 },
        ),
      ),
    );

    const service = new PhotoVerificationService(database as never);
    const result = await service.analyze({
      userId: "user",
      sessionId: "session",
      cellId: "cell",
      imageDataUrl: image,
    });

    expect(result.decision).toBe("REJECTED");
    expect(result.targetVisible).toBe(false);
  });

  it("requires high confidence and concrete visual evidence before approval", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            candidates: [
              {
                finishReason: "STOP",
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        decision: "APPROVED",
                        targetVisible: true,
                        confidence: 0.6,
                        evidence: [],
                        failureReasons: [],
                        retryGuide: "",
                      }),
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200 },
        ),
      ),
    );

    const service = new PhotoVerificationService(database as never);
    const result = await service.analyze({
      userId: "user",
      sessionId: "session",
      cellId: "cell",
      imageDataUrl: image,
    });

    expect(result.decision).toBe("NEEDS_REVIEW");
  });
});
