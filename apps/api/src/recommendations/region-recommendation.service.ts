import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { DatabaseClient } from "@travel-bingo/database";

import { DATABASE_CLIENT } from "../database/database.module.js";

const KTO_LOCATION_URL =
  "https://apis.data.go.kr/B551011/KorService2/locationBasedList2";
const KTO_PHOTO_SEARCH_URL =
  "https://apis.data.go.kr/B551011/PhotoGalleryService1/gallerySearchList1";
const KTO_RELATED_SEARCH_URL =
  "https://apis.data.go.kr/B551011/TarRlteTarService1/searchKeyword1";
const KTO_RELATED_BASE_MONTH = "202504";

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
type KtoPhotoItem = {
  galContentId?: string;
  galTitle?: string;
  galWebImageUrl?: string;
  galPhotographyLocation?: string;
  galPhotographer?: string;
  galSearchKeyword?: string;
};
type KtoRelatedItem = Record<string, unknown>;

export interface AdminAttractionRecommendation {
  readonly contentId: string;
  readonly contentTypeId: string | null;
  readonly title: string;
  readonly address: string | null;
  readonly imageUrl: string | null;
  readonly latitude: number;
  readonly longitude: number;
  readonly source: "KTO" | "DATABASE";
  readonly recommendationReason: "NEARBY" | "RELATED";
  readonly relatedRank: number | null;
  readonly photoCredit: string | null;
  readonly photoLocation: string | null;
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
    const relatedNames = ktoItems.length
      ? await this.fetchRelatedAttractionNames(
          query.trim() || ktoItems[0]?.title || region.name,
        )
      : new Map<string, number>();
    const recommendations: AdminAttractionRecommendation[] = ktoItems.length
      ? ktoItems
          .filter((item) => item.title && item.mapx && item.mapy)
          .map((item) => {
            const relatedRank = relatedNames.get(
              normalizeAttractionName(item.title),
            );
            return {
              contentId:
                item.contentid ?? `${item.title}-${item.mapx}-${item.mapy}`,
              contentTypeId: item.contenttypeid ?? null,
              title: item.title!,
              address: item.addr1 ?? null,
              imageUrl: item.firstimage || item.firstimage2 || null,
              latitude: Number(item.mapy),
              longitude: Number(item.mapx),
              source: "KTO" as const,
              recommendationReason: relatedRank
                ? ("RELATED" as const)
                : ("NEARBY" as const),
              relatedRank: relatedRank ?? null,
              photoCredit: null,
              photoLocation: null,
            };
          })
          .sort((first, second) => {
            if (first.relatedRank && second.relatedRank) {
              return first.relatedRank - second.relatedRank;
            }
            if (first.relatedRank) return -1;
            if (second.relatedRank) return 1;
            return 0;
          })
      : region.places.map((place) => ({
          contentId: place.externalContentId,
          contentTypeId: place.contentType,
          title: place.title,
          address: place.address,
          imageUrl: place.imageUrl,
          latitude: Number(place.latitude),
          longitude: Number(place.longitude),
          source: "DATABASE" as const,
          recommendationReason: "NEARBY" as const,
          relatedRank: null,
          photoCredit: null,
          photoLocation: null,
        }));
    const normalizedQuery = query.toLocaleLowerCase("ko");
    const selected = recommendations
      .filter(
        (item) =>
          !normalizedQuery ||
          item.title.toLocaleLowerCase("ko").includes(normalizedQuery) ||
          item.address?.toLocaleLowerCase("ko").includes(normalizedQuery),
      )
      .slice(0, limit);
    return Promise.all(
      selected.map((recommendation, index) =>
        recommendation.source === "KTO" &&
        index < 6
          ? this.enrichWithTourismPhoto(recommendation)
          : recommendation,
      ),
    );
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

  private async enrichWithTourismPhoto(
    recommendation: AdminAttractionRecommendation,
  ): Promise<AdminAttractionRecommendation> {
    const photo = await this.fetchTourismPhoto(recommendation.title);
    if (!photo?.galWebImageUrl) return recommendation;

    return {
      ...recommendation,
      imageUrl: photo.galWebImageUrl,
      photoCredit: photo.galPhotographer
        ? `한국관광공사 포토코리아 · ${photo.galPhotographer}`
        : "한국관광공사 포토코리아",
      photoLocation: photo.galPhotographyLocation?.trim() || null,
    };
  }

  private async fetchTourismPhoto(keyword: string): Promise<KtoPhotoItem | null> {
    const items = await this.fetchKtoItems<KtoPhotoItem>(
      KTO_PHOTO_SEARCH_URL,
      process.env.KTO_PHOTO_API_KEY || process.env.KTO_API_KEY,
      {
        keyword,
        arrange: "A",
        numOfRows: "10",
        pageNo: "1",
      },
    );
    if (!items.length) return null;

    const normalizedKeyword = normalizeAttractionName(keyword);
    return (
      items.find((item) => {
        const normalizedTitle = normalizeAttractionName(item.galTitle);
        return (
          Boolean(normalizedTitle) &&
          (normalizedTitle === normalizedKeyword ||
            normalizedTitle.includes(normalizedKeyword) ||
            normalizedKeyword.includes(normalizedTitle))
        );
      }) ?? null
    );
  }

  private async fetchRelatedAttractionNames(
    keyword: string,
  ): Promise<Map<string, number>> {
    const items = await this.fetchKtoItems<KtoRelatedItem>(
      KTO_RELATED_SEARCH_URL,
      process.env.KTO_RELATED_API_KEY || process.env.KTO_API_KEY,
      {
        keyword,
        baseYm: KTO_RELATED_BASE_MONTH,
        numOfRows: "50",
        pageNo: "1",
      },
    );
    const result = new Map<string, number>();
    items.forEach((item, index) => {
      const normalized = normalizeAttractionName(
        readRelatedAttractionName(item),
      );
      if (normalized && !result.has(normalized)) result.set(normalized, index + 1);
    });
    return result;
  }

  private async fetchKtoItems<T>(
    endpoint: string,
    rawServiceKey: string | undefined,
    values: Record<string, string>,
  ): Promise<T[]> {
    const serviceKey = normalizeKtoServiceKey(rawServiceKey);
    if (!serviceKey) return [];
    const parameters = new URLSearchParams({
      serviceKey,
      MobileOS: "ETC",
      MobileApp: "TravelBingo",
      _type: "json",
      ...values,
    });
    try {
      const response = await fetch(`${endpoint}?${parameters}`, {
        signal: AbortSignal.timeout(6_000),
      });
      if (!response.ok) return [];
      const payload = (await response.json()) as {
        response?: { body?: { items?: { item?: T | T[] } } };
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

export function normalizeAttractionName(value: unknown): string {
  return typeof value === "string"
    ? value
        .normalize("NFKC")
        .toLocaleLowerCase("ko")
        .replace(/[^0-9a-z가-힣]/g, "")
    : "";
}

export function readRelatedAttractionName(item: KtoRelatedItem): string {
  const keys = [
    "rlteTatsNm",
    "rlteTatsName",
    "relatedTouristAttractionName",
    "relatedAttractionName",
    "tatsNm",
    "title",
  ];
  for (const key of keys) {
    const value = item[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
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
