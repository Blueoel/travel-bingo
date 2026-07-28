CREATE TABLE `photo_mission_awards` (
	`id` text PRIMARY KEY NOT NULL,
	`verification_id` text NOT NULL,
	`guest_id` text NOT NULL,
	`mission_id` text NOT NULL,
	`daily_date` text NOT NULL,
	`points` integer NOT NULL,
	`awarded_at` integer NOT NULL,
	FOREIGN KEY (`verification_id`) REFERENCES `photo_verification_attempts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `photo_award_guest_mission_date_uq` ON `photo_mission_awards` (`guest_id`,`mission_id`,`daily_date`);--> statement-breakpoint
CREATE INDEX `photo_award_guest_date_idx` ON `photo_mission_awards` (`guest_id`,`daily_date`);--> statement-breakpoint
CREATE TABLE `photo_verification_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`guest_id` text NOT NULL,
	`mission_id` text NOT NULL,
	`mission_title` text NOT NULL,
	`daily_date` text NOT NULL,
	`decision` text NOT NULL,
	`target_visible` integer NOT NULL,
	`confidence` real NOT NULL,
	`evidence_json` text NOT NULL,
	`failure_reasons_json` text NOT NULL,
	`retry_guide` text,
	`model` text NOT NULL,
	`submitted_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `photo_attempt_guest_date_idx` ON `photo_verification_attempts` (`guest_id`,`daily_date`);--> statement-breakpoint
CREATE INDEX `photo_attempt_mission_date_idx` ON `photo_verification_attempts` (`mission_id`,`daily_date`);