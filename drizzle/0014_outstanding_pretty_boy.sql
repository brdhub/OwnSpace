CREATE TABLE `resume_entry_candidates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`resume_asset_id` integer NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`content_json` text NOT NULL,
	`source_excerpt` text NOT NULL,
	`duplicate_entry_id` integer,
	`duplicate_kind` text DEFAULT 'none' NOT NULL,
	`state` text DEFAULT 'pending' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`resume_asset_id`) REFERENCES `resume_assets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`duplicate_entry_id`) REFERENCES `resume_entries`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `resume_entry_candidates_asset_id_idx` ON `resume_entry_candidates` (`resume_asset_id`);--> statement-breakpoint
CREATE INDEX `resume_entry_candidates_state_idx` ON `resume_entry_candidates` (`state`);--> statement-breakpoint
ALTER TABLE `resume_assets` ADD `entry_extraction_status` text DEFAULT 'idle' NOT NULL;--> statement-breakpoint
ALTER TABLE `resume_assets` ADD `entry_extraction_error` text;--> statement-breakpoint
ALTER TABLE `resume_assets` ADD `entry_extracted_at` text;