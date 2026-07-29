import type { DailyLayoutIdentity } from "./daily-layout.js";

export const DAILY_DIFFICULTY_QUOTAS = {
  1: 13,
  2: 9,
  3: 3,
} as const;

const KIND_LIMITS: Readonly<Record<string, number>> = {
  PHOTO: 20,
  COMPOSITE: 4,
  QUIZ: 4,
  PLACE_VISIT: 4,
  WALK_DISTANCE: 1,
  WALK_STEPS: 1,
};

const HARD_SIMILARITY_LIMITS: Readonly<Record<string, number>> = {
  COLOR_SEARCH: 3,
};

export interface DailyMissionCandidate {
  readonly id: string;
  readonly difficulty: number;
  readonly kind: string;
  readonly similarityGroup: string | null;
}

export function selectPersonalizedDailyMissions<
  T extends DailyMissionCandidate,
>(
  identity: DailyLayoutIdentity,
  candidates: readonly T[],
  count = 25,
): readonly T[] {
  const uniqueCandidates = [
    ...new Map(
      candidates.map((candidate) => [candidate.id, candidate]),
    ).values(),
  ];
  const ordered = [...uniqueCandidates].sort((left, right) =>
    candidateHash(identity, left.id).localeCompare(
      candidateHash(identity, right.id),
    ),
  );
  const selected: T[] = [];

  for (const difficulty of [3, 2, 1] as const) {
    const difficultyTarget = Math.min(
      count,
      selected.length + DAILY_DIFFICULTY_QUOTAS[difficulty],
    );
    fill(
      selected,
      ordered.filter((candidate) => candidate.difficulty === difficulty),
      difficultyTarget,
      count,
      true,
      true,
      true,
    );
  }

  fill(selected, ordered, count, count, true, true, true);
  fill(selected, ordered, count, count, true, false, true);
  fill(selected, ordered, count, count, false, false, true);
  fill(selected, ordered, count, count, false, false, false);

  return selected.slice(0, count);
}

function fill<T extends DailyMissionCandidate>(
  selected: T[],
  candidates: readonly T[],
  targetCount: number,
  maximumCount: number,
  enforceSimilarityLimit: boolean,
  enforceKindLimit: boolean,
  enforceHardSimilarityLimit: boolean,
): void {
  for (const candidate of candidates) {
    if (selected.length >= targetCount || selected.length >= maximumCount)
      return;
    if (
      selected.some((selectedMission) => selectedMission.id === candidate.id)
    ) {
      continue;
    }
    if (
      enforceSimilarityLimit &&
      candidate.similarityGroup &&
      selected.some(
        (selectedMission) =>
          selectedMission.similarityGroup === candidate.similarityGroup,
      )
    ) {
      continue;
    }
    const similarityLimit = candidate.similarityGroup
      ? HARD_SIMILARITY_LIMITS[candidate.similarityGroup]
      : undefined;
    if (
      enforceHardSimilarityLimit &&
      candidate.similarityGroup &&
      similarityLimit !== undefined &&
      selected.filter(
        (selectedMission) =>
          selectedMission.similarityGroup === candidate.similarityGroup,
      ).length >= similarityLimit
    ) {
      continue;
    }
    const kindLimit = KIND_LIMITS[candidate.kind];
    if (
      enforceKindLimit &&
      kindLimit !== undefined &&
      selected.filter(
        (selectedMission) => selectedMission.kind === candidate.kind,
      ).length >= kindLimit
    ) {
      continue;
    }
    selected.push(candidate);
  }
}

function candidateHash(
  identity: DailyLayoutIdentity,
  candidateId: string,
): string {
  const input = `${identity.date}:${identity.userId}:${identity.dailyVersion}:${candidateId}`;
  let first = 2_166_136_261;
  let second = 2_166_136_261;
  for (let index = 0; index < input.length; index += 1) {
    first ^= input.charCodeAt(index);
    first = Math.imul(first, 16_777_619);
    second ^= input.charCodeAt(input.length - index - 1);
    second = Math.imul(second, 16_777_619);
  }
  return `${(first >>> 0).toString(16).padStart(8, "0")}${(second >>> 0)
    .toString(16)
    .padStart(8, "0")}`;
}
