import { createHmac, timingSafeEqual } from "node:crypto";

import { Injectable, ServiceUnavailableException } from "@nestjs/common";

const TOKEN_PREFIX = "travel-bingo-qr-v1";

@Injectable()
export class MissionQrService {
  issue(missionId: string): string {
    const encodedMissionId = Buffer.from(missionId, "utf8").toString(
      "base64url",
    );
    const payload = `${TOKEN_PREFIX}.${encodedMissionId}`;
    return `${payload}.${this.signature(payload)}`;
  }

  verifies(token: string, expectedMissionId: string): boolean {
    const normalized = token.trim();
    const parts = normalized.split(".");
    if (parts.length !== 3 || parts[0] !== TOKEN_PREFIX) return false;

    const payload = `${parts[0]}.${parts[1]}`;
    const receivedSignature = Buffer.from(parts[2] ?? "", "base64url");
    const expectedSignature = Buffer.from(this.signature(payload), "base64url");
    if (
      receivedSignature.length !== expectedSignature.length ||
      !timingSafeEqual(receivedSignature, expectedSignature)
    ) {
      return false;
    }

    try {
      return (
        Buffer.from(parts[1] ?? "", "base64url").toString("utf8") ===
        expectedMissionId
      );
    } catch {
      return false;
    }
  }

  private signature(payload: string): string {
    const secret =
      process.env.QR_SIGNING_SECRET?.trim() ||
      process.env.ADMIN_API_KEY?.trim();
    if (!secret) {
      throw new ServiceUnavailableException(
        "QR mission signing is not configured.",
      );
    }
    return createHmac("sha256", secret)
      .update(`mission-qr:${payload}`)
      .digest("base64url");
  }
}
