PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_photo_verification_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`guest_id` text NOT NULL,
	`mission_id` text NOT NULL,
	`mission_title` text NOT NULL,
	`points` integer DEFAULT 0 NOT NULL,
	`daily_date` text NOT NULL,
	`decision` text NOT NULL,
	`target_visible` integer NOT NULL,
	`confidence` real NOT NULL,
	`evidence_json` text NOT NULL,
	`failure_reasons_json` text NOT NULL,
	`retry_guide` text,
	`photo_key` text,
	`review_decision` text,
	`reviewer_email` text,
	`reviewed_at` integer,
	`model` text NOT NULL,
	`submitted_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_photo_verification_attempts`("id", "guest_id", "mission_id", "mission_title", "points", "daily_date", "decision", "target_visible", "confidence", "evidence_json", "failure_reasons_json", "retry_guide", "photo_key", "review_decision", "reviewer_email", "reviewed_at", "model", "submitted_at") SELECT "id", "guest_id", "mission_id", "mission_title", "points", "daily_date", "decision", "target_visible", "confidence", "evidence_json", "failure_reasons_json", "retry_guide", "photo_key", "review_decision", "reviewer_email", "reviewed_at", "model", "submitted_at" FROM `photo_verification_attempts`;--> statement-breakpoint
DROP TABLE `photo_verification_attempts`;--> statement-breakpoint
ALTER TABLE `__new_photo_verification_attempts` RENAME TO `photo_verification_attempts`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `photo_attempt_guest_date_idx` ON `photo_verification_attempts` (`guest_id`,`daily_date`);--> statement-breakpoint
CREATE INDEX `photo_attempt_mission_date_idx` ON `photo_verification_attempts` (`mission_id`,`daily_date`);