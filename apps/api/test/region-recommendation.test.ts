import { describe, expect, it } from "vitest";

import {
  distanceKm,
  RegionRecommendationService,
} from "../src/recommendations/region-recommendation.service.js";

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
