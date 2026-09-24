CREATE TABLE `interview_simulations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`application_id` integer,
	`company` text NOT NULL,
	`role` text NOT NULL,
	`jd_snapshot` text NOT NULL,
	`resume_name` text NOT NULL,
	`resume_snapshot` text NOT NULL,
	`model` text NOT NULL,
	`questions_json` text NOT NULL,
	`phase` text DEFAULT 'main_answer' NOT NULL,
	`current_index` integer DEFAULT 0 NOT NULL,
	`busy` integer DEFAULT false NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `interview_simulations_application_id_idx` ON `interview_simulations` (`application_id`);