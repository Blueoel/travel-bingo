import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { Injectable, ServiceUnavailableException } from "@nestjs/common";

const TOKEN_PREFIX = "travel-bingo-qr-v2";
const DEFAULT_VALID_HOURS = 24;
const MAX_VALID_HOURS = 24 * 30;

interface MissionQrPayload {
  readonly missionId: string;
  readonly issuedAt: number;
  readonly expiresAt: number;
  readonly nonce: string;
}

export interface IssuedMissionQr {
  readonly token: string;
  readonly issuedAt: Date;
  readonly expiresAt: Date;
  readonly validHours: number;
}

export type MissionQrInspection =
  | {
      readonly valid: true;
      readonly issuedAt: Date;
      readonly expiresAt: Date;
    }
  | {
      readonly valid: false;
      readonly reason: "INVALID" | "EXPIRED";
    };

@Injectable()
export class MissionQrService {
  issue(
    missionId: string,
    validHours = DEFAULT_VALID_HOURS,
    now = new Date(),
  ): IssuedMissionQr {
    if (
      !Number.isInteger(validHours) ||
      validHours < 1 ||
      validHours > MAX_VALID_HOURS
    ) {
      throw new RangeError(
        `QR validity must be between 1 and ${MAX_VALID_HOURS} hours.`,
      );
    }
    const issuedAt = new Date(now);
    const expiresAt = new Date(
      issuedAt.getTime() + validHours * 60 * 60 * 1000,
    );
    const encodedPayload = Buffer.from(
      JSON.stringify({
        missionId,
        issuedAt: issuedAt.getTime(),
        expiresAt: expiresAt.getTime(),
        nonce: randomBytes(12).toString("base64url"),
      } satisfies MissionQrPayload),
      "utf8",
    ).toString("base64url");
    const payload = `${TOKEN_PREFIX}.${encodedPayload}`;
    return {
      token: `${payload}.${this.signature(payload)}`,
      issuedAt,
      expiresAt,
      validHours,
    };
  }

  verifies(
    token: string,
    expectedMissionId: string,
    now = new Date(),
  ): boolean {
    return this.inspect(token, expectedMissionId, now).valid;
  }

  inspect(
    token: string,
    expectedMissionId: string,
    now = new Date(),
  ): MissionQrInspection {
    const normalized = token.trim();
    const parts = normalized.split(".");
    if (parts.length !== 3 || parts[0] !== TOKEN_PREFIX) {
      return { valid: false, reason: "INVALID" };
    }

    const payload = `${parts[0]}.${parts[1]}`;
    const receivedSignature = Buffer.from(parts[2] ?? "", "base64url");
    const expectedSignature = Buffer.from(this.signature(payload), "base64url");
    if (
      receivedSignature.length !== expectedSignature.length ||
      !timingSafeEqual(receivedSignature, expectedSignature)
    ) {
      return { valid: false, reason: "INVALID" };
    }

    try {
      const payload = JSON.parse(
        Buffer.from(parts[1] ?? "", "base64url").toString("utf8"),
      ) as Partial<MissionQrPayload>;
      if (
        payload.missionId !== expectedMissionId ||
        typeof payload.issuedAt !== "number" ||
        typeof payload.expiresAt !== "number" ||
        typeof payload.nonce !== "string" ||
        payload.nonce.length < 8 ||
        !Number.isFinite(payload.issuedAt) ||
        !Number.isFinite(payload.expiresAt) ||
        payload.expiresAt <= payload.issuedAt ||
        payload.issuedAt > now.getTime() + 5 * 60 * 1000
      ) {
        return { valid: false, reason: "INVALID" };
      }
      if (payload.expiresAt <= now.getTime()) {
        return { valid: false, reason: "EXPIRED" };
      }
      return {
        valid: true,
        issuedAt: new Date(payload.issuedAt),
        expiresAt: new Date(payload.expiresAt),
      };
    } catch {
      return { valid: false, reason: "INVALID" };
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
