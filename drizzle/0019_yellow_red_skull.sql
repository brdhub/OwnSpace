CREATE TABLE `resume_ai_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` integer,
	`operation` text NOT NULL,
	`input_revision` integer NOT NULL,
	`input_hash` text NOT NULL,
	`status` text NOT NULL,
	`model` text,
	`prompt_version` text NOT NULL,
	`started_at` text NOT NULL,
	`finished_at` text,
	`error_code` text,
	`input_tokens` integer,
	`output_tokens` integer,
	FOREIGN KEY (`task_id`) REFERENCES `resume_optimization_tasks`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `resume_ai_runs_task_operation_running_unique` ON `resume_ai_runs` (`task_id`,`operation`) WHERE "resume_ai_runs"."status" = 'running';--> statement-breakpoint
CREATE TABLE `resume_drafts` (
	`task_id` integer PRIMARY KEY NOT NULL,
	`content_json` text NOT NULL,
	`schema_version` integer DEFAULT 1 NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `resume_optimization_tasks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_resume_versions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`task_id` integer,
	`name` text DEFAULT '未命名版本' NOT NULL,
	`version_number` integer DEFAULT 1 NOT NULL,
	`schema_version` integer DEFAULT 1 NOT NULL,
	`template_version` text DEFAULT 'classic-v1' NOT NULL,
	`idempotency_key` text,
	`accepted_content_json` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `resume_optimization_tasks`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_resume_versions`("id", "task_id", "name", "version_number", "schema_version", "template_version", "idempotency_key", "accepted_content_json", "created_at") SELECT "id", "task_id", '历史版本 ' || "id", "id", 0, 'classic-v1', NULL, "accepted_content_json", "created_at" FROM `resume_versions`;--> statement-breakpoint
DROP TABLE `resume_versions`;--> statement-breakpoint
ALTER TABLE `__new_resume_versions` RENAME TO `resume_versions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `resume_versions_idempotency_key_unique` ON `resume_versions` (`idempotency_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `resume_versions_task_version_unique` ON `resume_versions` (`task_id`,`version_number`);--> statement-breakpoint
ALTER TABLE `resume_optimization_suggestions` ADD `input_revision` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `resume_optimization_tasks` ADD `input_revision` integer DEFAULT 1 NOT NULL;
