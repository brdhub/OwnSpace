CREATE TABLE `github_resume_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`status` text DEFAULT 'ready' NOT NULL,
	`input_json` text NOT NULL,
	`view_json` text DEFAULT '{}' NOT NULL,
	`call_count` integer DEFAULT 0 NOT NULL,
	`request_count` integer DEFAULT 0 NOT NULL,
	`lease_token` text,
	`lease_until` integer DEFAULT 0 NOT NULL,
	`error` text,
	`entry_id` integer,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`entry_id`) REFERENCES `resume_entries`(`id`) ON UPDATE no action ON DELETE set null
);
