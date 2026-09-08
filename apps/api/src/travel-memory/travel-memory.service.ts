import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { DatabaseClient } from "@travel-bingo/database";
import { DATABASE_CLIENT } from "../database/database.module.js";

const IMAGE_DATA_URL = /^data:image\/(jpeg|png|webp);base64,/i;
const MAX_DATA_URL_LENGTH = 8 * 1024 * 1024;

@Injectable()
export class TravelMemoryService {
  constructor(@Inject(DATABASE_CLIENT) private readonly database: DatabaseClient) {}

  async list(userId: string) {
    const items = await this.database.userRegionMemory.findMany({ where: { userId }, orderBy: { selectedAt: "desc" } });
    return { items: items.map(toPublic) };
  }

  async get(userId: string, regionCode: string) {
    const item = await this.database.userRegionMemory.findUnique({ where: { userId_regionCode: { userId, regionCode } } });
    return item ? toPublic(item) : { regionCode, lineCount: 0, unlocked: false, photoUrl: null, selectedAt: null };
  }

  async save(userId: string, regionCode: string, body: unknown) {
    const input = body && typeof body === "object" ? body as Record<string, unknown> : {};
    const imageDataUrl = typeof input.imageDataUrl === "string" ? input.imageDataUrl : "";
    const lineCount = typeof input.lineCount === "number" ? Math.floor(input.lineCount) : 0;
    if (!/^\d{2,10}$/.test(regionCode)) throw new NotFoundException("지원하지 않는 지역입니다.");
    if (!IMAGE_DATA_URL.test(imageDataUrl) || imageDataUrl.length > MAX_DATA_URL_LENGTH) {
      throw new BadRequestException("8MB 이하의 JPG, PNG 또는 WebP 이미지를 선택해주세요.");
    }
    if (lineCount < 3) throw new BadRequestException("지역 빙고 세 줄을 먼저 완성해주세요.");
    const item = await this.database.userRegionMemory.upsert({
      where: { userId_regionCode: { userId, regionCode } },
      create: { userId, regionCode, imageDataUrl, lineCount },
      update: { imageDataUrl, lineCount, selectedAt: new Date() },
    });
    return toPublic(item);
  }
}

function toPublic(item: { regionCode: string; imageDataUrl: string; lineCount: number; selectedAt: Date }) {
  return { regionCode: item.regionCode, lineCount: item.lineCount, unlocked: item.lineCount >= 3, photoUrl: item.imageDataUrl, selectedAt: item.selectedAt.toISOString() };
}
