import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const photoVerificationAttempts = sqliteTable(
  "photo_verification_attempts",
  {
    id: text("id").primaryKey(),
    guestId: text("guest_id").notNull(),
    missionId: text("mission_id").notNull(),
    missionTitle: text("mission_title").notNull(),
    points: integer("points").notNull().default(0),
    dailyDate: text("daily_date").notNull(),
    decision: text("decision").notNull(),
    targetVisible: integer("target_visible", { mode: "boolean" }).notNull(),
    confidence: real("confidence").notNull(),
    evidenceJson: text("evidence_json").notNull(),
    failureReasonsJson: text("failure_reasons_json").notNull(),
    retryGuide: text("retry_guide"),
    photoKey: text("photo_key"),
    reviewDecision: text("review_decision"),
    reviewerEmail: text("reviewer_email"),
    reviewedAt: integer("reviewed_at", { mode: "timestamp_ms" }),
    model: text("model").notNull(),
    submittedAt: integer("submitted_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("photo_attempt_guest_date_idx").on(table.guestId, table.dailyDate),
    index("photo_attempt_mission_date_idx").on(
      table.missionId,
      table.dailyDate,
    ),
  ],
);

export const photoMissionAwards = sqliteTable(
  "photo_mission_awards",
  {
    id: text("id").primaryKey(),
    verificationId: text("verification_id")
      .notNull()
      .references(() => photoVerificationAttempts.id),
    guestId: text("guest_id").notNull(),
    missionId: text("mission_id").notNull(),
    dailyDate: text("daily_date").notNull(),
    points: integer("points").notNull(),
    awardedAt: integer("awarded_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("photo_award_guest_mission_date_uq").on(
      table.guestId,
      table.missionId,
      table.dailyDate,
    ),
    index("photo_award_guest_date_idx").on(table.guestId, table.dailyDate),
  ],
);
