ALTER TABLE `photo_verification_attempts` ADD `mission_description` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `photo_verification_attempts` ADD `verification_label` text DEFAULT '사진 인증' NOT NULL;--> statement-breakpoint
ALTER TABLE `photo_verification_attempts` ADD `review_reason` text;