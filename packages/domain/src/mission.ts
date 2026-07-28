export const MISSION_POINTS = {
  EASY: 10,
  NORMAL: 20,
  HARD: 30,
  SPECIAL: 50,
} as const;

export type MissionDifficulty = keyof typeof MISSION_POINTS;

export function pointsForDifficulty(difficulty: MissionDifficulty): number {
  return MISSION_POINTS[difficulty];
}
