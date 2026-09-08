import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { DatabaseClient } from "@travel-bingo/database";

import { DATABASE_CLIENT } from "../database/database.module.js";

const KTO_LOCATION_URL =
  "https://apis.data.go.kr/B551011/KorService2/locationBasedList2";
const KTO_LEGAL_REGION_URL =
  "https://apis.data.go.kr/B551011/KorService2/ldongCode2";
const KTO_AREA_BASED_URL =
  "https://apis.data.go.kr/B551011/KorService2/areaBasedList2";
const KTO_SYNC_URL =
  "https://apis.data.go.kr/B551011/KorService2/areaBasedSyncList2";
const KTO_DETAIL_URL =
  "https://apis.data.go.kr/B551011/KorService2/detailCommon2";
const KTO_IMAGE_URL =
  "https://apis.data.go.kr/B551011/KorService2/detailImage2";
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
  modifiedtime?: string;
  createdtime?: string;
  showflag?: string;
};
type KtoImageItem = { originimgurl?: string; smallimageurl?: string };
type KtoPhotoItem = {
  galContentId?: string;
  galTitle?: string;
  galWebImageUrl?: string;
  galPhotographyLocation?: string;
  galPhotographer?: string;
  galSearchKeyword?: string;
};
type KtoRelatedItem = Record<string, unknown>;
type KtoLegalRegionItem = {
  code?: string;
  name?: string;
};

const PRIORITY_ADMINISTRATIVE_REGIONS: readonly AdminRegionSearchResult[] = [
  priorityRegion("44150", "충청남도 공주시", "충청남도", "44", "150"),
];

export interface AdminRegionSearchResult {
  readonly administrativeCode: string;
  readonly name: string;
  readonly province: string;
  readonly legalRegionCode: string;
  readonly legalSigunguCode: string | null;
  readonly registeredRegionId: string | null;
}

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
  readonly distanceKm: number;
  readonly contentCategory: string;
  readonly existingMission: {
    readonly id: string;
    readonly title: string;
    readonly status: string;
  } | null;
}

export interface AttractionSearchOptions {
  readonly contentTypeId?: string;
  readonly radiusKm?: number;
}

export interface RegisterAdministrativeRegionInput {
  readonly administrativeCode: string;
  readonly name: string;
  readonly province: string;
  readonly legalRegionCode: string;
  readonly legalSigunguCode: string | null;
}

export interface RegisteredAdminRegion {
  readonly id: string;
  readonly name: string;
  readonly administrativeCode: string;
  readonly status: string;
}

@Injectable()
export class RegionRecommendationService {
  private regionDirectoryCache:
    | { expiresAt: number; entries: AdminRegionSearchResult[] }
    | undefined;
  private readonly attractionCache = new Map<
    string,
    { freshUntil: number; staleUntil: number; items: KtoItem[] }
  >();

  constructor(
    @Inject(DATABASE_CLIENT) private readonly database: DatabaseClient,
  ) {}

  async searchAdministrativeRegions(
    query: string,
    limit: number,
  ): Promise<AdminRegionSearchResult[]> {
    const normalizedQuery = normalizeRegionName(query);
    if (!normalizedQuery) return [];

    const priorityMatches = PRIORITY_ADMINISTRATIVE_REGIONS.filter((region) =>
      normalizeRegionName(
        `${region.name} ${region.province} ${region.administrativeCode}`,
      ).includes(normalizedQuery),
    );
    const directory = priorityMatches.length
      ? priorityMatches
      : await this.loadAdministrativeRegionDirectory();
    const matched = directory
      .filter((region) => {
        const searchable = normalizeRegionName(
          `${region.name} ${region.province} ${region.administrativeCode}`,
        );
        return searchable.includes(normalizedQuery);
      })
      .slice(0, limit);
    if (!matched.length) return [];

    const registered = await this.database.region.findMany({
      where: {
        administrativeCode: {
          in: matched.map((region) => region.administrativeCode),
        },
      },
      select: { id: true, administrativeCode: true },
    });
    const registeredByCode = new Map(
      registered.map((region) => [region.administrativeCode, region.id]),
    );
    return matched.map((region) => ({
      ...region,
      registeredRegionId:
        registeredByCode.get(region.administrativeCode) ?? null,
    }));
  }

  async ensureAdministrativeRegion(
    input: RegisterAdministrativeRegionInput,
  ): Promise<RegisteredAdminRegion> {
    const existing = await this.database.region.findUnique({
      where: { administrativeCode: input.administrativeCode },
    });
    if (existing) return existing;

    const center = await this.findAdministrativeRegionCenter(input);
    return this.database.region.upsert({
      where: { administrativeCode: input.administrativeCode },
      update: {
        name: input.name,
        centerLatitude: center.latitude,
        centerLongitude: center.longitude,
      },
      create: {
        name: input.name,
        administrativeCode: input.administrativeCode,
        centerLatitude: center.latitude,
        centerLongitude: center.longitude,
        status: "INACTIVE",
      },
    });
  }

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
        const kto = await this.findKtoAttraction(center, region.id);
        const saved = region.places[0];
        return {
          id: region.id,
          name: region.name,
          distanceKm: current ? Math.round(distance * 10) / 10 : null,
          attraction: kto
            ? {
                title: kto.title ?? region.name,
                address: kto.addr1 ?? null,
                imageUrl: normalizeImageUrl(
                  kto.firstimage || kto.firstimage2 || null,
                ),
                latitude: Number(kto.mapy) || center.latitude,
                longitude: Number(kto.mapx) || center.longitude,
                source: "KTO" as const,
              }
            : saved
              ? {
                  title: saved.title,
                  address: saved.address,
                  imageUrl: normalizeImageUrl(saved.imageUrl),
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
    options: AttractionSearchOptions = {},
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
    const radiusKm = options.radiusKm ?? 20;
    const ktoItems = await this.fetchKtoAttractions(center, 30, {
      ...(options.contentTypeId
        ? { contentTypeId: options.contentTypeId }
        : {}),
      radiusM: Math.round(radiusKm * 1_000),
    }, region.id);
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
              imageUrl: normalizeImageUrl(
                item.firstimage || item.firstimage2 || null,
              ),
              latitude: Number(item.mapy),
              longitude: Number(item.mapx),
              source: "KTO" as const,
              recommendationReason: relatedRank
                ? ("RELATED" as const)
                : ("NEARBY" as const),
              relatedRank: relatedRank ?? null,
              photoCredit: null,
              photoLocation: null,
              distanceKm: roundedDistanceKm(center, {
                latitude: Number(item.mapy),
                longitude: Number(item.mapx),
              }),
              contentCategory: contentTypeName(item.contenttypeid),
              existingMission: null,
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
      : region.places
          .map((place) => ({
            contentId: place.externalContentId,
            contentTypeId: place.contentType,
            title: place.title,
            address: place.address,
            imageUrl: normalizeImageUrl(place.imageUrl),
            latitude: Number(place.latitude),
            longitude: Number(place.longitude),
            source: "DATABASE" as const,
            recommendationReason: "NEARBY" as const,
            relatedRank: null,
            photoCredit: null,
            photoLocation: null,
            distanceKm: roundedDistanceKm(center, {
              latitude: Number(place.latitude),
              longitude: Number(place.longitude),
            }),
            contentCategory: contentTypeName(place.contentType),
            existingMission: null,
          }))
          .filter((item) => item.distanceKm <= radiusKm)
          .filter(
            (item) =>
              !options.contentTypeId ||
              item.contentTypeId === options.contentTypeId,
          );
    const normalizedQuery = query.toLocaleLowerCase("ko");
    const selected = recommendations
      .filter(
        (item) =>
          !normalizedQuery ||
          item.title.toLocaleLowerCase("ko").includes(normalizedQuery) ||
          item.address?.toLocaleLowerCase("ko").includes(normalizedQuery),
      )
      .slice(0, limit);
    const enriched = await Promise.all(
      selected.map((recommendation, index) =>
        recommendation.source === "KTO" && index < 6
          ? this.enrichWithTourismPhoto(recommendation)
          : recommendation,
      ),
    );
    const existingMissions = await this.findExistingMissions(
      regionId,
      enriched,
    );
    return enriched.map((recommendation) => ({
      ...recommendation,
      existingMission:
        existingMissions.get(attractionKey(recommendation)) ?? null,
    }));
  }

  private async findKtoAttraction(
    center: Coordinates,
    regionId: string,
  ): Promise<KtoItem | null> {
    const items = await this.fetchKtoAttractions(center, 12, {}, regionId);
    const withImages = items.filter(
      (candidate) =>
        candidate.title &&
        candidate.mapx &&
        candidate.mapy &&
        (candidate.firstimage || candidate.firstimage2),
    );
    const candidates = withImages.length
      ? withImages
      : items.filter(
        (candidate) => candidate.title && candidate.mapx && candidate.mapy,
      );
    if (!candidates.length) return null;

    const rotationWindow = Math.floor(Date.now() / 60_000);
    const regionSeed =
      Math.round(center.latitude * 1_000) +
      Math.round(center.longitude * 1_000);
    const selected = (
      candidates[Math.abs(rotationWindow + regionSeed) % candidates.length] ??
      null
    );
    if (!selected) return null;
    const hydrated = await this.hydrateKtoItem(selected);
    await this.persistKtoAttractions(regionId, [hydrated]);
    return hydrated;
  }

  private async loadAdministrativeRegionDirectory(): Promise<
    AdminRegionSearchResult[]
  > {
    if (
      this.regionDirectoryCache &&
      this.regionDirectoryCache.expiresAt > Date.now()
    ) {
      return this.regionDirectoryCache.entries;
    }

    const provinces = await this.fetchKtoItems<KtoLegalRegionItem>(
      KTO_LEGAL_REGION_URL,
      process.env.KTO_API_KEY,
      { numOfRows: "50", pageNo: "1" },
    );
    const entries = (
      await Promise.all(
        provinces
          .filter((province) => province.code && province.name)
          .map(async (province) => {
            const provinceCode = province.code!.trim();
            const provinceName = province.name!.trim();
            if (isMetropolitanRegion(provinceName)) {
              return [
                toAdministrativeRegionEntry({
                  provinceCode,
                  provinceName,
                  child: null,
                }),
              ];
            }

            const children = await this.fetchKtoItems<KtoLegalRegionItem>(
              KTO_LEGAL_REGION_URL,
              process.env.KTO_API_KEY,
              {
                lDongRegnCd: provinceCode,
                numOfRows: "100",
                pageNo: "1",
              },
            );
            return children
              .filter((child) => child.code && child.name)
              .map((child) =>
                toAdministrativeRegionEntry({
                  provinceCode,
                  provinceName,
                  child,
                }),
              );
          }),
      )
    ).flat();

    const uniqueEntries = [
      ...new Map(
        entries.map((entry) => [entry.administrativeCode, entry]),
      ).values(),
    ].sort((first, second) => first.name.localeCompare(second.name, "ko"));
    this.regionDirectoryCache = {
      expiresAt: Date.now() + 6 * 60 * 60 * 1_000,
      entries: uniqueEntries,
    };
    return uniqueEntries;
  }

  private async findAdministrativeRegionCenter(
    input: RegisterAdministrativeRegionInput,
  ): Promise<Coordinates> {
    const items = await this.fetchKtoItems<KtoItem>(
      KTO_AREA_BASED_URL,
      process.env.KTO_API_KEY,
      {
        lDongRegnCd: input.legalRegionCode,
        ...(input.legalSigunguCode
          ? { lDongSignguCd: input.legalSigunguCode }
          : {}),
        arrange: "A",
        numOfRows: "100",
        pageNo: "1",
      },
    );
    const coordinates = items
      .map((item) => ({
        latitude: Number(item.mapy),
        longitude: Number(item.mapx),
      }))
      .filter(
        (item) =>
          Number.isFinite(item.latitude) &&
          Number.isFinite(item.longitude) &&
          item.latitude >= 32 &&
          item.latitude <= 39 &&
          item.longitude >= 124 &&
          item.longitude <= 132,
      );
    if (coordinates.length) {
      return {
        latitude:
          coordinates.reduce((sum, item) => sum + item.latitude, 0) /
          coordinates.length,
        longitude:
          coordinates.reduce((sum, item) => sum + item.longitude, 0) /
          coordinates.length,
      };
    }
    return provinceFallbackCenter(input.legalRegionCode);
  }

  async syncChangedAttractions(since = new Date(Date.now() - 25 * 60 * 60_000)): Promise<{
    received: number;
    updated: number;
    deactivated: number;
  }> {
    const items = await this.fetchKtoItems<KtoItem>(
      KTO_SYNC_URL,
      process.env.KTO_API_KEY,
      {
        modifiedTime: formatKtoTimestamp(since),
        arrange: "C",
        numOfRows: "1000",
        pageNo: "1",
      },
    );
    if (!items.length) return { received: 0, updated: 0, deactivated: 0 };

    const regions = await this.database.region.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, centerLatitude: true, centerLongitude: true },
    });
    let updated = 0;
    let deactivated = 0;
    for (const item of items) {
      if (!item.contentid) continue;
      const contentType = item.contenttypeid || "TOURIST_SPOT";
      if (item.showflag === "0") {
        const result = await this.database.place.updateMany({
          where: { source: "KTO", externalContentId: item.contentid },
          data: { status: "INACTIVE", syncedAt: new Date() },
        });
        deactivated += result.count;
        continue;
      }
      const latitude = Number(item.mapy);
      const longitude = Number(item.mapx);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !item.title) continue;
      const nearest = regions
        .map((region) => ({
          id: region.id,
          distance: distanceKm(
            { latitude, longitude },
            { latitude: Number(region.centerLatitude), longitude: Number(region.centerLongitude) },
          ),
        }))
        .sort((a, b) => a.distance - b.distance)[0];
      if (!nearest || nearest.distance > 30) continue;
      await this.persistKtoAttractions(nearest.id, [{ ...item, contenttypeid: contentType }]);
      updated += 1;
    }
    this.attractionCache.clear();
    return { received: items.length, updated, deactivated };
  }

  private async hydrateKtoItem(item: KtoItem): Promise<KtoItem> {
    if (!item.contentid || (item.firstimage || item.firstimage2)) return item;
    const [details, images] = await Promise.all([
      this.fetchKtoItems<KtoItem>(KTO_DETAIL_URL, process.env.KTO_API_KEY, {
        contentId: item.contentid,
        defaultYN: "Y",
        firstImageYN: "Y",
        addrinfoYN: "Y",
        mapinfoYN: "Y",
        overviewYN: "N",
        numOfRows: "10",
        pageNo: "1",
      }),
      this.fetchKtoItems<KtoImageItem>(KTO_IMAGE_URL, process.env.KTO_API_KEY, {
        contentId: item.contentid,
        imageYN: "Y",
        subImageYN: "Y",
        numOfRows: "10",
        pageNo: "1",
      }),
    ]);
    const detail = details[0];
    const image = images[0];
    const firstimage = detail?.firstimage || image?.originimgurl || item.firstimage;
    const firstimage2 = detail?.firstimage2 || image?.smallimageurl || item.firstimage2;
    return {
      ...item,
      ...detail,
      ...(firstimage ? { firstimage } : {}),
      ...(firstimage2 ? { firstimage2 } : {}),
    };
  }

  private async persistKtoAttractions(regionId: string, items: readonly KtoItem[]): Promise<void> {
    const placeClient = (this.database as DatabaseClient & { place?: DatabaseClient["place"] }).place;
    if (!placeClient?.upsert) return;
    const syncedAt = new Date();
    for (const item of items) {
      const latitude = Number(item.mapy);
      const longitude = Number(item.mapx);
      if (!item.contentid || !item.title || !Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
      const contentType = item.contenttypeid || "TOURIST_SPOT";
      const data = {
        regionId,
        title: item.title.trim(),
        address: item.addr1?.trim() || null,
        latitude,
        longitude,
        imageUrl: normalizeImageUrl(item.firstimage || item.firstimage2 || null),
        sourceUpdatedAt: parseKtoTimestamp(item.modifiedtime || item.createdtime),
        syncedAt,
        status: "ACTIVE" as const,
      };
      await placeClient.upsert({
        where: {
          source_externalContentId_contentType: {
            source: "KTO",
            externalContentId: item.contentid,
            contentType,
          },
        },
        update: data,
        create: {
          ...data,
          source: "KTO",
          externalContentId: item.contentid,
          contentType,
        },
      });
    }
  }

  private async loadSavedKtoAttractions(regionId: string, limit: number): Promise<KtoItem[]> {
    const placeClient = (this.database as DatabaseClient & { place?: DatabaseClient["place"] }).place;
    if (!placeClient?.findMany) return [];
    const places = await placeClient.findMany({
      where: { regionId, source: "KTO", status: "ACTIVE" },
      orderBy: [{ sourceUpdatedAt: "desc" }, { syncedAt: "desc" }],
      take: limit,
    });
    return places.map((place) => ({
      contentid: place.externalContentId,
      contenttypeid: place.contentType,
      title: place.title,
      ...(place.address ? { addr1: place.address } : {}),
      ...(place.imageUrl ? { firstimage: place.imageUrl } : {}),
      mapx: String(place.longitude),
      mapy: String(place.latitude),
      ...(place.sourceUpdatedAt ? { modifiedtime: formatKtoTimestamp(place.sourceUpdatedAt) } : {}),
    }));
  }

  private async fetchKtoAttractions(
    center: Coordinates,
    limit: number,
    options: { contentTypeId?: string; radiusM?: number } = {},
    regionId?: string,
  ): Promise<KtoItem[]> {
    const serviceKey = normalizeKtoServiceKey(process.env.KTO_API_KEY);
    if (!serviceKey) return regionId ? this.loadSavedKtoAttractions(regionId, limit) : [];
    const cacheKey = `${center.latitude.toFixed(4)}:${center.longitude.toFixed(4)}:${options.contentTypeId ?? ""}:${options.radiusM ?? 20_000}:${limit}`;
    const cached = this.attractionCache.get(cacheKey);
    if (cached && cached.freshUntil > Date.now()) return cached.items;
    const parameters = new URLSearchParams({
      serviceKey,
      MobileOS: "ETC",
      MobileApp: "TravelBingo",
      _type: "json",
      mapX: String(center.longitude),
      mapY: String(center.latitude),
      radius: String(options.radiusM ?? 20_000),
      arrange: "E",
      numOfRows: String(limit),
      pageNo: "1",
    });
    if (options.contentTypeId) {
      parameters.set("contentTypeId", options.contentTypeId);
    }
    try {
      const response = await fetch(`${KTO_LOCATION_URL}?${parameters}`, {
        signal: AbortSignal.timeout(6_000),
      });
      if (!response.ok) throw new Error(`KTO_${response.status}`);
      const payload = (await response.json()) as {
        response?: {
          body?: { items?: { item?: KtoItem | KtoItem[] } };
        };
      };
      const item = payload.response?.body?.items?.item;
      const items = Array.isArray(item) ? item : item ? [item] : [];
      this.attractionCache.set(cacheKey, {
        freshUntil: Date.now() + 10 * 60_000,
        staleUntil: Date.now() + 24 * 60 * 60_000,
        items,
      });
      if (regionId && items.length) await this.persistKtoAttractions(regionId, items);
      return items;
    } catch {
      if (cached && cached.staleUntil > Date.now()) return cached.items;
      return regionId ? this.loadSavedKtoAttractions(regionId, limit) : [];
    }
  }

  private async enrichWithTourismPhoto(
    recommendation: AdminAttractionRecommendation,
  ): Promise<AdminAttractionRecommendation> {
    const photo = await this.fetchTourismPhoto(recommendation.title);
    if (!photo?.galWebImageUrl) return recommendation;

    return {
      ...recommendation,
      imageUrl: normalizeImageUrl(photo.galWebImageUrl),
      photoCredit: photo.galPhotographer
        ? `한국관광공사 포토코리아 · ${photo.galPhotographer}`
        : "한국관광공사 포토코리아",
      photoLocation: photo.galPhotographyLocation?.trim() || null,
    };
  }

  private async fetchTourismPhoto(
    keyword: string,
  ): Promise<KtoPhotoItem | null> {
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
      if (normalized && !result.has(normalized))
        result.set(normalized, index + 1);
    });
    return result;
  }

  private async findExistingMissions(
    regionId: string,
    recommendations: readonly AdminAttractionRecommendation[],
  ): Promise<Map<string, { id: string; title: string; status: string }>> {
    const missionClient = (
      this.database as unknown as {
        mission?: {
          findMany?: (input: unknown) => Promise<
            Array<{
              id: string;
              title: string;
              status: string;
              place: {
                externalContentId: string;
                contentType: string;
              } | null;
            }>
          >;
        };
      }
    ).mission;
    if (!missionClient?.findMany || !recommendations.length) return new Map();

    const externalContentIds = [
      ...new Set(recommendations.map((item) => item.contentId)),
    ];
    const missions = await missionClient.findMany({
      where: {
        scope: "REGION",
        regionLinks: { some: { regionId } },
        place: { is: { externalContentId: { in: externalContentIds } } },
      },
      include: { place: true },
      orderBy: { updatedAt: "desc" },
    });
    const result = new Map<
      string,
      { id: string; title: string; status: string }
    >();
    for (const mission of missions) {
      if (!mission.place) continue;
      const key = `${mission.place.externalContentId}:${mission.place.contentType}`;
      if (!result.has(key)) {
        result.set(key, {
          id: mission.id,
          title: mission.title,
          status: mission.status,
        });
      }
    }
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

function priorityRegion(
  administrativeCode: string,
  name: string,
  province: string,
  legalRegionCode: string,
  legalSigunguCode: string,
): AdminRegionSearchResult {
  return {
    administrativeCode,
    name,
    province,
    legalRegionCode,
    legalSigunguCode,
    registeredRegionId: null,
  };
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

export function normalizeRegionName(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("ko").replace(/\s+/g, "");
}

export function parseKtoTimestamp(value: string | undefined): Date | null {
  if (!value || !/^\d{14}$/.test(value)) return null;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(4, 6)) - 1;
  const day = Number(value.slice(6, 8));
  const hour = Number(value.slice(8, 10));
  const minute = Number(value.slice(10, 12));
  const second = Number(value.slice(12, 14));
  const parsed = new Date(Date.UTC(year, month, day, hour - 9, minute, second));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatKtoTimestamp(value: Date): string {
  const korea = new Date(value.getTime() + 9 * 60 * 60_000);
  return [
    korea.getUTCFullYear(),
    String(korea.getUTCMonth() + 1).padStart(2, "0"),
    String(korea.getUTCDate()).padStart(2, "0"),
    String(korea.getUTCHours()).padStart(2, "0"),
    String(korea.getUTCMinutes()).padStart(2, "0"),
    String(korea.getUTCSeconds()).padStart(2, "0"),
  ].join("");
}

function normalizeImageUrl(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  if (!normalized) return null;
  if (normalized.startsWith("http://")) {
    return `https://${normalized.slice("http://".length)}`;
  }
  return normalized;
}

function isMetropolitanRegion(name: string): boolean {
  return /(특별시|광역시|특별자치시)$/.test(name);
}

function toAdministrativeRegionEntry(input: {
  provinceCode: string;
  provinceName: string;
  child: KtoLegalRegionItem | null;
}): AdminRegionSearchResult {
  if (!input.child?.code || !input.child.name) {
    return {
      administrativeCode: input.provinceCode,
      name: input.provinceName,
      province: input.provinceName,
      legalRegionCode: input.provinceCode,
      legalSigunguCode: null,
      registeredRegionId: null,
    };
  }

  const rawChildCode = input.child.code.trim();
  const sigunguCode = rawChildCode.startsWith(input.provinceCode)
    ? rawChildCode.slice(input.provinceCode.length)
    : rawChildCode;
  return {
    administrativeCode: rawChildCode.startsWith(input.provinceCode)
      ? rawChildCode
      : `${input.provinceCode}${rawChildCode}`,
    name: `${input.provinceName} ${input.child.name.trim()}`,
    province: input.provinceName,
    legalRegionCode: input.provinceCode,
    legalSigunguCode: sigunguCode || null,
    registeredRegionId: null,
  };
}

function provinceFallbackCenter(legalRegionCode: string): Coordinates {
  const centers: Record<string, Coordinates> = {
    "11": { latitude: 37.5665, longitude: 126.978 },
    "26": { latitude: 35.1796, longitude: 129.0756 },
    "27": { latitude: 35.8714, longitude: 128.6014 },
    "28": { latitude: 37.4563, longitude: 126.7052 },
    "29": { latitude: 35.1595, longitude: 126.8526 },
    "30": { latitude: 36.3504, longitude: 127.3845 },
    "31": { latitude: 35.5384, longitude: 129.3114 },
    "36": { latitude: 36.48, longitude: 127.289 },
    "41": { latitude: 37.4138, longitude: 127.5183 },
    "42": { latitude: 37.8228, longitude: 128.1555 },
    "43": { latitude: 36.6357, longitude: 127.4917 },
    "44": { latitude: 36.6588, longitude: 126.6728 },
    "45": { latitude: 35.8203, longitude: 127.1088 },
    "46": { latitude: 34.8161, longitude: 126.4629 },
    "47": { latitude: 36.576, longitude: 128.5056 },
    "48": { latitude: 35.2383, longitude: 128.6924 },
    "50": { latitude: 33.489, longitude: 126.4983 },
  };
  return centers[legalRegionCode.slice(0, 2)] ?? centers["11"]!;
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

function roundedDistanceKm(first: Coordinates, second: Coordinates): number {
  return Math.round(distanceKm(first, second) * 10) / 10;
}

function attractionKey(
  attraction: Pick<
    AdminAttractionRecommendation,
    "contentId" | "contentTypeId"
  >,
): string {
  return `${attraction.contentId}:${attraction.contentTypeId ?? "TOURIST_SPOT"}`;
}

export function contentTypeName(
  contentTypeId: string | null | undefined,
): string {
  const names: Record<string, string> = {
    "12": "관광지",
    "14": "문화시설",
    "15": "축제·행사",
    "25": "여행코스",
    "28": "레포츠",
    "32": "숙박",
    "38": "쇼핑",
    "39": "음식점",
    TOURIST_SPOT: "관광지",
  };
  return names[contentTypeId ?? ""] ?? "기타 관광정보";
}
