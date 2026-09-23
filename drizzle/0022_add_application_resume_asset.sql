ALTER TABLE `applications` ADD `resume_asset_id` integer REFERENCES `resume_assets`(`id`) ON DELETE set null;
--> statement-breakpoint
CREATE INDEX `applications_resume_asset_id_idx` ON `applications` (`resume_asset_id`);
