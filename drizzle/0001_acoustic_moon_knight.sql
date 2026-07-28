ALTER TABLE `photo_verification_attempts` ADD `points` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `photo_verification_attempts` ADD `photo_key` text;--> statement-breakpoint
ALTER TABLE `photo_verification_attempts` ADD `review_decision` text;--> statement-breakpoint
ALTER TABLE `photo_verification_attempts` ADD `reviewer_email` text;--> statement-breakpoint
ALTER TABLE `photo_verification_attempts` ADD `reviewed_at` integer;
