CREATE TABLE `study_checkins` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`checkin_date` text NOT NULL,
	`category` text NOT NULL,
	`is_completed` integer DEFAULT false NOT NULL,
	`duration_minutes` integer,
	`quantity` integer,
	`title` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`source_url` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `study_checkins_date_category_unique` ON `study_checkins` (`checkin_date`,`category`);