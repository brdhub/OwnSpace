ALTER TABLE `resume_ai_runs` ADD `stage` text DEFAULT 'prepare' NOT NULL;--> statement-breakpoint
ALTER TABLE `resume_ai_runs` ADD `execution_id` text;--> statement-breakpoint
ALTER TABLE `resume_ai_runs` ADD `heartbeat_at` text;--> statement-breakpoint
ALTER TABLE `resume_ai_runs` ADD `input_json` text;--> statement-breakpoint
ALTER TABLE `resume_ai_runs` ADD `target_material_id` integer;--> statement-breakpoint
ALTER TABLE `resume_ai_runs` ADD `call_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `resume_ai_runs` ADD `duration_ms` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `resume_ai_runs` ADD `fallback_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `resume_ai_runs` ADD `checkpoints_cleared` integer DEFAULT false NOT NULL;