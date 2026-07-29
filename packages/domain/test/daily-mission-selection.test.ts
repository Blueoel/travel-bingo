import { describe, expect, it } from "vitest";

import {
  selectPersonalizedDailyMissions,
  type DailyMissionCandidate,
} from "../src/index.js";

const identity = {
  date: "2026-07-29",
  userId: "selection-user",
  dailyVersion: 3,
} as const;

function candidates(): DailyMissionCandidate[] {
  return [
    ...Array.from({ length: 20 }, (_, index) => ({
      id: `easy-${index}`,
      difficulty: 1,
      kind: index < 12 ? "CHECK_IN" : "PHOTO",
      similarityGroup: index < 7 ? `EASY_${index}` : null,
    })),
    ...Array.from({ length: 12 }, (_, index) => ({
      id: `normal-${index}`,
      difficulty: 2,
      kind: index < 6 ? "PHOTO" : "CHECK_IN",
      similarityGroup: index < 4 ? `NORMAL_${index}` : null,
    })),
    ...Array.from({ length: 6 }, (_, index) => ({
      id: `hard-${index}`,
      difficulty: 3,
      kind: "CHECK_IN",
      similarityGroup: null,
    })),
  ];
}

describe("personalized Daily mission selection", () => {
  it("keeps the configured difficulty composition when the pool is sufficient", () => {
    const selected = selectPersonalizedDailyMissions(identity, candidates());

    expect(selected).toHaveLength(25);
    expect(selected.filter((mission) => mission.difficulty === 1)).toHaveLength(
      13,
    );
    expect(selected.filter((mission) => mission.difficulty === 2)).toHaveLength(
      9,
    );
    expect(selected.filter((mission) => mission.difficulty === 3)).toHaveLength(
      3,
    );
    expect(
      selected.filter((mission) => mission.kind === "PHOTO").length,
    ).toBeLessThanOrEqual(20);
  });

  it("selects different missions for different users and remains deterministic", () => {
    const first = selectPersonalizedDailyMissions(identity, candidates());
    const repeated = selectPersonalizedDailyMissions(identity, candidates());
    const other = selectPersonalizedDailyMissions(
      { ...identity, userId: "another-user" },
      candidates(),
    );

    expect(repeated.map(({ id }) => id)).toEqual(first.map(({ id }) => id));
    expect(other.map(({ id }) => id)).not.toEqual(first.map(({ id }) => id));
  });

  it("avoids duplicate similarity groups whenever enough alternatives exist", () => {
    const pool = Array.from({ length: 32 }, (_, index) => ({
      id: `color-${index}`,
      difficulty: index < 13 ? 1 : index < 22 ? 2 : 3,
      kind: "CHECK_IN",
      similarityGroup: index < 7 ? "COLOR_SEARCH" : `GROUP_${index}`,
    }));
    const selected = selectPersonalizedDailyMissions(identity, pool);

    expect(
      selected.filter((mission) => mission.similarityGroup === "COLOR_SEARCH"),
    ).toHaveLength(1);
  });

  it("fills the board from other difficulties when a quota is short", () => {
    const pool = candidates().filter((mission) => mission.difficulty !== 3);
    const selected = selectPersonalizedDailyMissions(identity, pool);

    expect(selected).toHaveLength(25);
    expect(selected.every((mission) => mission.difficulty !== 3)).toBe(true);
  });

  it("keeps color missions to three when non-color alternatives can fill the board", () => {
    const pool = [
      ...Array.from({ length: 10 }, (_, index) => ({
        id: `color-${index}`,
        difficulty: index < 6 ? 1 : 2,
        kind: "PHOTO",
        similarityGroup: "COLOR_SEARCH",
      })),
      ...Array.from({ length: 22 }, (_, index) => ({
        id: `other-${index}`,
        difficulty: index < 12 ? 1 : index < 20 ? 2 : 3,
        kind: "CHECK_IN",
        similarityGroup: `OTHER_${index}`,
      })),
    ];

    const selected = selectPersonalizedDailyMissions(identity, pool);

    expect(selected).toHaveLength(25);
    expect(
      selected.filter((mission) => mission.similarityGroup === "COLOR_SEARCH"),
    ).toHaveLength(3);
  });

  it("builds a complete board from the current 50-mission catalog shape", () => {
    const pool = [
      ...Array.from({ length: 29 }, (_, index) => ({
        id: `catalog-easy-${index}`,
        difficulty: 1,
        kind: index < 23 ? "PHOTO" : "CHECK_IN",
        similarityGroup: index < 6 ? "COLOR_SEARCH" : `CATALOG_EASY_${index}`,
      })),
      ...Array.from({ length: 16 }, (_, index) => ({
        id: `catalog-normal-${index}`,
        difficulty: 2,
        kind: index < 13 ? "PHOTO" : "COMPOSITE",
        similarityGroup: index < 2 ? "COLOR_SEARCH" : `CATALOG_NORMAL_${index}`,
      })),
      ...Array.from({ length: 5 }, (_, index) => ({
        id: `catalog-hard-${index}`,
        difficulty: 3,
        kind: index < 4 ? "PHOTO" : "WALK_DISTANCE",
        similarityGroup: `CATALOG_HARD_${index}`,
      })),
    ];

    const selected = selectPersonalizedDailyMissions(identity, pool);

    expect(selected).toHaveLength(25);
    expect(selected.filter((mission) => mission.difficulty === 1)).toHaveLength(
      13,
    );
    expect(selected.filter((mission) => mission.difficulty === 2)).toHaveLength(
      9,
    );
    expect(selected.filter((mission) => mission.difficulty === 3)).toHaveLength(
      3,
    );
    expect(
      selected.filter((mission) => mission.similarityGroup === "COLOR_SEARCH"),
    ).toHaveLength(1);
    expect(
      selected.filter((mission) => mission.kind !== "PHOTO").length,
    ).toBeGreaterThanOrEqual(5);
    expect(new Set(selected.map(({ id }) => id)).size).toBe(25);
  });
});
