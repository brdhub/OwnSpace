CREATE TABLE `resume_assets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`original_name` text NOT NULL,
	`storage_key` text NOT NULL,
	`mime_type` text NOT NULL,
	`byte_size` integer NOT NULL,
	`extracted_text` text DEFAULT '' NOT NULL,
	`parse_status` text DEFAULT 'pending' NOT NULL,
	`parse_error` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `resume_assets_storage_key_unique` ON `resume_assets` (`storage_key`);--> statement-breakpoint
CREATE TABLE `resume_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`content_json` text NOT NULL,
	`tags_json` text DEFAULT '[]' NOT NULL,
	`completeness` text DEFAULT 'incomplete' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `resume_optimization_materials` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`task_id` integer NOT NULL,
	`kind` text NOT NULL,
	`resume_asset_id` integer,
	`resume_entry_id` integer,
	`snapshot_json` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `resume_optimization_tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`resume_asset_id`) REFERENCES `resume_assets`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`resume_entry_id`) REFERENCES `resume_entries`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `resume_optimization_suggestions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`task_id` integer NOT NULL,
	`material_id` integer NOT NULL,
	`original_text` text NOT NULL,
	`proposed_text` text NOT NULL,
	`rationale` text NOT NULL,
	`state` text DEFAULT 'pending' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `resume_optimization_tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`material_id`) REFERENCES `resume_optimization_materials`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `resume_optimization_tasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`jd_source` text NOT NULL,
	`jd_image_storage_key` text,
	`jd_text` text DEFAULT '' NOT NULL,
	`target_role` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`ai_output_json` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `resume_versions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`task_id` integer NOT NULL,
	`accepted_content_json` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `resume_optimization_tasks`(`id`) ON UPDATE no action ON DELETE cascade
);
