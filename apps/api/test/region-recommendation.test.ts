import { afterEach, describe, expect, it, vi } from "vitest";

import {
  distanceKm,
  normalizeAttractionName,
  normalizeKtoServiceKey,
  readRelatedAttractionName,
  RegionRecommendationService,
} from "../src/recommendations/region-recommendation.service.js";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("KTO service key normalization", () => {
  it("keeps a decoding key unchanged", () => {
    expect(normalizeKtoServiceKey("abc+/=123")).toBe("abc+/=123");
  });

  it("decodes an encoding key before URLSearchParams encodes it once", () => {
    expect(normalizeKtoServiceKey("abc%2B%2F%3D123")).toBe("abc+/=123");
  });

  it("trims whitespace and handles a missing key", () => {
    expect(normalizeKtoServiceKey("  abc123  ")).toBe("abc123");
    expect(normalizeKtoServiceKey(undefined)).toBe("");
  });
});

describe("region recommendation distance", () => {
  it("calculates zero for identical coordinates", () => {
    expect(
      distanceKm(
        { latitude: 37.008, longitude: 127.2797 },
        { latitude: 37.008, longitude: 127.2797 },
      ),
    ).toBe(0);
  });

  it("orders nearby regions using kilometer distance", () => {
    const current = { latitude: 37.0, longitude: 127.28 };
    const nearby = distanceKm(current, {
      latitude: 37.008,
      longitude: 127.2797,
    });
    const faraway = distanceKm(current, {
      latitude: 37.75,
      longitude: 128.9,
    });
    expect(nearby).toBeLessThan(2);
    expect(faraway).toBeGreaterThan(100);
  });

  it("queries active service regions and falls back to saved attractions", async () => {
    let query: unknown;
    const service = new RegionRecommendationService({
      region: {
        findMany: async (input: unknown) => {
          query = input;
          return [
            {
              id: "region-1",
              name: "경기도 안성시",
              centerLatitude: 37.008,
              centerLongitude: 127.2797,
              places: [
                {
                  title: "안성맞춤랜드",
                  address: "경기도 안성시",
                  imageUrl: null,
                  latitude: 37.03,
                  longitude: 127.31,
                },
              ],
            },
          ];
        },
      },
    } as never);

    const result = await service.recommend(null, 3);

    expect(query).toMatchObject({ where: { status: "ACTIVE" } });
    expect(result[0]).toMatchObject({
      name: "경기도 안성시",
      attraction: {
        title: "안성맞춤랜드",
        source: "DATABASE",
      },
    });
  });

  it("provides saved attraction candidates for an inactive region admin", async () => {
    const service = new RegionRecommendationService({
      region: {
        findUnique: async () => ({
          id: "region-draft",
          centerLatitude: 37.008,
          centerLongitude: 127.2797,
          places: [
            {
              externalContentId: "place-1",
              contentType: "TOURIST_SPOT",
              title: "안성맞춤랜드",
              address: "경기도 안성시",
              imageUrl: "https://example.com/place.jpg",
              latitude: 37.03,
              longitude: 127.31,
            },
          ],
        }),
      },
    } as never);

    const result = await service.searchRegionAttractions(
      "region-draft",
      "맞춤",
      12,
    );

    expect(result).toEqual([
      expect.objectContaining({
        contentId: "place-1",
        title: "안성맞춤랜드",
        source: "DATABASE",
      }),
    ]);
  });
});

describe("admin tourism data enrichment", () => {
  const database = {
    region: {
      findUnique: async () => ({
        id: "region-anseong",
        name: "경기도 안성시",
        centerLatitude: 37.008,
        centerLongitude: 127.2797,
        places: [],
      }),
    },
  };

  it("fills a missing attraction image with Photo Korea attribution", async () => {
    vi.stubEnv("KTO_API_KEY", "main-key");
    vi.stubEnv("KTO_PHOTO_API_KEY", "photo-key");
    vi.stubEnv("KTO_RELATED_API_KEY", "related-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        const item = url.includes("locationBasedList2")
          ? {
              title: "안성성당",
              addr1: "경기도 안성시",
              mapx: "127.271",
              mapy: "37.005",
              contentid: "1",
            }
          : url.includes("gallerySearchList1")
            ? {
                galTitle: "안성성당",
                galWebImageUrl: "https://example.com/anseong.jpg",
                galPhotographer: "홍길동",
                galPhotographyLocation: "경기도 안성시",
              }
            : undefined;
        return new Response(
          JSON.stringify({ response: { body: { items: { item } } } }),
          { status: 200 },
        );
      }),
    );

    const service = new RegionRecommendationService(database as never);
    const [result] = await service.searchRegionAttractions(
      "region-anseong",
      "",
      12,
    );

    expect(result).toMatchObject({
      title: "안성성당",
      imageUrl: "https://example.com/anseong.jpg",
      photoCredit: "한국관광공사 포토코리아 · 홍길동",
      photoLocation: "경기도 안성시",
    });
  });

  it("prioritizes a nearby place found in related attraction data", async () => {
    vi.stubEnv("KTO_API_KEY", "main-key");
    vi.stubEnv("KTO_RELATED_API_KEY", "related-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        const item = url.includes("locationBasedList2")
          ? [
              {
                title: "안성성당",
                firstimage: "https://example.com/church.jpg",
                mapx: "127.271",
                mapy: "37.005",
                contentid: "1",
              },
              {
                title: "안성맞춤랜드",
                firstimage: "https://example.com/land.jpg",
                mapx: "127.31",
                mapy: "37.03",
                contentid: "2",
              },
            ]
          : url.includes("searchKeyword1")
            ? [{ rlteTatsNm: "안성맞춤랜드" }]
            : undefined;
        return new Response(
          JSON.stringify({ response: { body: { items: { item } } } }),
          { status: 200 },
        );
      }),
    );

    const service = new RegionRecommendationService(database as never);
    const result = await service.searchRegionAttractions(
      "region-anseong",
      "",
      12,
    );

    expect(result[0]).toMatchObject({
      title: "안성맞춤랜드",
      recommendationReason: "RELATED",
      relatedRank: 1,
    });
    expect(result[1]?.recommendationReason).toBe("NEARBY");
  });

  it("applies type and radius filters and marks an existing regional mission", async () => {
    vi.stubEnv("KTO_API_KEY", "main-key");
    const requestedUrls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        requestedUrls.push(url);
        const item = url.includes("locationBasedList2")
          ? {
              title: "안성맞춤랜드",
              addr1: "경기도 안성시",
              firstimage: "https://example.com/land.jpg",
              mapx: "127.31",
              mapy: "37.03",
              contentid: "kto-place-1",
              contenttypeid: "12",
            }
          : undefined;
        return new Response(
          JSON.stringify({ response: { body: { items: { item } } } }),
          { status: 200 },
        );
      }),
    );
    const service = new RegionRecommendationService({
      region: database.region,
      mission: {
        findMany: async () => [
          {
            id: "mission-1",
            title: "안성맞춤랜드 방문하기",
            status: "ACTIVE",
            place: {
              externalContentId: "kto-place-1",
              contentType: "12",
            },
          },
        ],
      },
    } as never);

    const [result] = await service.searchRegionAttractions(
      "region-anseong",
      "",
      12,
      { contentTypeId: "12", radiusKm: 5 },
    );

    const locationRequest = new URL(
      requestedUrls.find((url) => url.includes("locationBasedList2"))!,
    );
    expect(locationRequest.searchParams.get("contentTypeId")).toBe("12");
    expect(locationRequest.searchParams.get("radius")).toBe("5000");
    expect(result).toMatchObject({
      contentCategory: "관광지",
      distanceKm: expect.any(Number),
      existingMission: {
        id: "mission-1",
        title: "안성맞춤랜드 방문하기",
      },
    });
  });

  it("normalizes attraction names and reads supported related-name fields", () => {
    expect(normalizeAttractionName(" 안성 맞춤-랜드 ")).toBe("안성맞춤랜드");
    expect(readRelatedAttractionName({ rlteTatsNm: "안성맞춤랜드" })).toBe(
      "안성맞춤랜드",
    );
  });
});
