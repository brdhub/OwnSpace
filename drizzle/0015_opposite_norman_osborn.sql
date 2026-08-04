CREATE TABLE `recruitment_opportunities` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source_record_id` text NOT NULL,
	`company` text NOT NULL,
	`batch` text DEFAULT '' NOT NULL,
	`source_updated_date` text,
	`company_type` text DEFAULT '' NOT NULL,
	`industry` text DEFAULT '' NOT NULL,
	`roles` text DEFAULT '' NOT NULL,
	`cities` text DEFAULT '' NOT NULL,
	`unrestricted_major` integer DEFAULT false NOT NULL,
	`application_url` text,
	`is_active` integer DEFAULT true NOT NULL,
	`synced_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `recruitment_opportunities_source_record_id_unique` ON `recruitment_opportunities` (`source_record_id`);--> statement-breakpoint
CREATE INDEX `recruitment_opportunities_is_active_idx` ON `recruitment_opportunities` (`is_active`);--> statement-breakpoint
ALTER TABLE `applications` ADD `opportunity_id` integer REFERENCES recruitment_opportunities(id);