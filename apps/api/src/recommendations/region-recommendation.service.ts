import { Inject, Injectable, NotFoundException } from "@nestjs/common";
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

export interface AdminAttractionRecommendation {
  readonly contentId: string;
  readonly contentTypeId: string | null;
  readonly title: string;
  readonly address: string | null;
  readonly imageUrl: string | null;
  readonly latitude: number;
  readonly longitude: number;
  readonly source: "KTO" | "DATABASE";
}

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
      where: {
        status: "ACTIVE",
        templates: {
          some: {
            status: "PUBLISHED",
            type: "REGION",
            OR: [{ startsAt: null }, { startsAt: { lte: new Date() } }],
            AND: [{ OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }] }],
          },
        },
      },
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

  async searchRegionAttractions(
    regionId: string,
    query: string,
    limit: number,
  ): Promise<AdminAttractionRecommendation[]> {
    const region = await this.database.region.findUnique({
      where: { id: regionId },
      include: {
        places: {
          where: { status: "ACTIVE" },
          orderBy: { updatedAt: "desc" },
          take: 30,
        },
      },
    });
    if (!region) throw new NotFoundException("Region not found.");

    const center = {
      latitude: Number(region.centerLatitude),
      longitude: Number(region.centerLongitude),
    };
    const ktoItems = await this.fetchKtoAttractions(center, 30);
    const recommendations: AdminAttractionRecommendation[] = ktoItems.length
      ? ktoItems
          .filter((item) => item.title && item.mapx && item.mapy)
          .map((item) => ({
            contentId: item.contentid ?? `${item.title}-${item.mapx}-${item.mapy}`,
            contentTypeId: item.contenttypeid ?? null,
            title: item.title!,
            address: item.addr1 ?? null,
            imageUrl: item.firstimage || item.firstimage2 || null,
            latitude: Number(item.mapy),
            longitude: Number(item.mapx),
            source: "KTO" as const,
          }))
      : region.places.map((place) => ({
          contentId: place.externalContentId,
          contentTypeId: place.contentType,
          title: place.title,
          address: place.address,
          imageUrl: place.imageUrl,
          latitude: Number(place.latitude),
          longitude: Number(place.longitude),
          source: "DATABASE" as const,
        }));
    const normalizedQuery = query.toLocaleLowerCase("ko");
    return recommendations
      .filter(
        (item) =>
          !normalizedQuery ||
          item.title.toLocaleLowerCase("ko").includes(normalizedQuery) ||
          item.address?.toLocaleLowerCase("ko").includes(normalizedQuery),
      )
      .slice(0, limit);
  }

  private async findKtoAttraction(
    center: Coordinates,
  ): Promise<KtoItem | null> {
    const items = await this.fetchKtoAttractions(center, 12);
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
  }

  private async fetchKtoAttractions(
    center: Coordinates,
    limit: number,
  ): Promise<KtoItem[]> {
    const serviceKey = normalizeKtoServiceKey(process.env.KTO_API_KEY);
    if (!serviceKey) return [];
    const parameters = new URLSearchParams({
      serviceKey,
      MobileOS: "ETC",
      MobileApp: "TravelBingo",
      _type: "json",
      mapX: String(center.longitude),
      mapY: String(center.latitude),
      radius: "20000",
      arrange: "E",
      numOfRows: String(limit),
      pageNo: "1",
    });
    try {
      const response = await fetch(`${KTO_LOCATION_URL}?${parameters}`, {
        signal: AbortSignal.timeout(6_000),
      });
      if (!response.ok) return [];
      const payload = (await response.json()) as {
        response?: {
          body?: { items?: { item?: KtoItem | KtoItem[] } };
        };
      };
      const item = payload.response?.body?.items?.item;
      return Array.isArray(item) ? item : item ? [item] : [];
    } catch {
      return [];
    }
  }
}

export function normalizeKtoServiceKey(value: string | undefined): string {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return "";

  try {
    return decodeURIComponent(trimmed);
  } catch {
    return trimmed;
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
