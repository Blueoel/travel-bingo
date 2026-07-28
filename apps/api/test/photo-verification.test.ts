import { BadRequestException, ServiceUnavailableException } from "@nestjs/common";
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
      },
    })),
  },
};

describe("PhotoVerificationService", () => {
  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
    vi.restoreAllMocks();
  });

  it("rejects unsupported image data before calling AI", async () => {
    const service = new PhotoVerificationService(database as never);
    await expect(service.analyze({
      userId: "user",
      sessionId: "session",
      cellId: "cell",
      imageDataUrl: "data:text/plain;base64,dGVzdA==",
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it("does not silently approve when the API key is missing", async () => {
    const service = new PhotoVerificationService(database as never);
    await expect(service.analyze({
      userId: "user",
      sessionId: "session",
      cellId: "cell",
      imageDataUrl: image,
    })).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it("returns a structured verdict after safety and vision checks", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        results: [{ flagged: false }],
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        output_text: JSON.stringify({
          decision: "APPROVED",
          confidence: 0.94,
          evidence: ["교차로 신호등이 선명하게 보임"],
          failureReasons: [],
          retryGuide: null,
        }),
      }), { status: 200 })));

    const service = new PhotoVerificationService(database as never);
    const result = await service.analyze({
      userId: "user",
      sessionId: "session",
      cellId: "cell",
      imageDataUrl: image,
    });

    expect(result.decision).toBe("APPROVED");
    expect(result.confidence).toBe(0.94);
    expect(result.model).toBe("gpt-5.6-luna");
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
