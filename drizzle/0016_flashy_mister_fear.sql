DELETE FROM `resume_optimization_suggestions`;--> statement-breakpoint
DELETE FROM `resume_optimization_materials`;--> statement-breakpoint
DELETE FROM `resume_versions`;--> statement-breakpoint
DELETE FROM `resume_optimization_tasks`;--> statement-breakpoint
DELETE FROM `resume_entry_candidates`;--> statement-breakpoint
DELETE FROM `resume_entries`;--> statement-breakpoint
UPDATE `resume_assets`
SET `entry_extraction_status` = 'idle',
    `entry_extraction_error` = NULL,
    `entry_extracted_at` = NULL,
    `updated_at` = CURRENT_TIMESTAMP;--> statement-breakpoint
ALTER TABLE `resume_entry_candidates` ADD `tags_json` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `resume_entries` DROP COLUMN `completeness`;
