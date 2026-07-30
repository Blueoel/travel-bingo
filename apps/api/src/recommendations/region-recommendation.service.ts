import { Inject, Injectable } from "@nestjs/common";
import type { DatabaseClient } from "@travel-bingo/database";

import { DATABASE_CLIENT } from "../database/database.module.js";

const KTO_LOCATION_URL =
  "https://apis.data.go.kr/B551011/KorService2/locationBasedList2";

type Coordinates = { latitude: number; longitude: number };
type KtoItem = {
  title?: string;
  addr1?: string;
  firstimage?: string;
  firstimage2?: string;
  mapx?: string;
  mapy?: string;
  contentid?: string;
  contenttypeid?: string;
};

@Injectable()
export class RegionRecommendationService {
  constructor(
    @Inject(DATABASE_CLIENT) private readonly database: DatabaseClient,
  ) {}

  async recommend(
    current: Coordinates | null,
    limit: number,
  ): Promise<
    Array<{
      id: string;
      name: string;
      distanceKm: number | null;
      attraction: {
        title: string;
        address: string | null;
        imageUrl: string | null;
        latitude: number;
        longitude: number;
        source: "KTO" | "DATABASE";
      } | null;
    }>
  > {
    const regions = await this.database.region.findMany({
      where: { status: "ACTIVE" },
      include: {
        places: {
          where: { status: "ACTIVE" },
          orderBy: { updatedAt: "desc" },
          take: 1,
        },
      },
    });
    const ranked = regions
      .map((region) => {
        const center = {
          latitude: Number(region.centerLatitude),
          longitude: Number(region.centerLongitude),
        };
        return {
          region,
          center,
          distanceKm: current
            ? distanceKm(current, center)
            : Number.POSITIVE_INFINITY,
        };
      })
      .sort((a, b) =>
        current
          ? a.distanceKm - b.distanceKm
          : a.region.name.localeCompare(b.region.name, "ko"),
      )
      .slice(0, limit);

    return Promise.all(
      ranked.map(async ({ region, center, distanceKm: distance }) => {
        const kto = await this.findKtoAttraction(center);
        const saved = region.places[0];
        return {
          id: region.id,
          name: region.name,
          distanceKm: current ? Math.round(distance * 10) / 10 : null,
          attraction: kto
            ? {
                title: kto.title ?? region.name,
                address: kto.addr1 ?? null,
                imageUrl: kto.firstimage || kto.firstimage2 || null,
                latitude: Number(kto.mapy) || center.latitude,
                longitude: Number(kto.mapx) || center.longitude,
                source: "KTO" as const,
              }
            : saved
              ? {
                  title: saved.title,
                  address: saved.address,
                  imageUrl: saved.imageUrl,
                  latitude: Number(saved.latitude),
                  longitude: Number(saved.longitude),
                  source: "DATABASE" as const,
                }
              : null,
        };
      }),
    );
  }

  private async findKtoAttraction(
    center: Coordinates,
  ): Promise<KtoItem | null> {
    const serviceKey = process.env.KTO_API_KEY?.trim();
    if (!serviceKey) return null;
    const parameters = new URLSearchParams({
      serviceKey,
      MobileOS: "ETC",
      MobileApp: "TravelBingo",
      _type: "json",
      mapX: String(center.longitude),
      mapY: String(center.latitude),
      radius: "20000",
      arrange: "E",
      numOfRows: "12",
      pageNo: "1",
    });
    try {
      const response = await fetch(`${KTO_LOCATION_URL}?${parameters}`, {
        signal: AbortSignal.timeout(6_000),
      });
      if (!response.ok) return null;
      const payload = (await response.json()) as {
        response?: {
          body?: { items?: { item?: KtoItem | KtoItem[] } };
        };
      };
      const item = payload.response?.body?.items?.item;
      const items = Array.isArray(item) ? item : item ? [item] : [];
      return (
        items.find(
          (candidate) =>
            candidate.title &&
            candidate.mapx &&
            candidate.mapy &&
            (candidate.firstimage || candidate.firstimage2),
        ) ??
        items.find(
          (candidate) => candidate.title && candidate.mapx && candidate.mapy,
        ) ??
        null
      );
    } catch {
      return null;
    }
  }
}

export function distanceKm(first: Coordinates, second: Coordinates): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = radians(second.latitude - first.latitude);
  const longitudeDelta = radians(second.longitude - first.longitude);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(first.latitude)) *
      Math.cos(radians(second.latitude)) *
      Math.sin(longitudeDelta / 2) ** 2;
  return 6_371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
