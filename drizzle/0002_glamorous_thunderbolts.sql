CREATE TABLE `interview_notes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`application_id` integer,
	`company_snapshot` text NOT NULL,
	`role_snapshot` text NOT NULL,
	`round` text NOT NULL,
	`interview_date` text NOT NULL,
	`result` text DEFAULT 'unknown' NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`reflection` text DEFAULT '' NOT NULL,
	`next_action` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `interview_question_tags` (
	`interview_question_id` integer NOT NULL,
	`interview_tag_id` integer NOT NULL,
	PRIMARY KEY(`interview_question_id`, `interview_tag_id`),
	FOREIGN KEY (`interview_question_id`) REFERENCES `interview_questions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`interview_tag_id`) REFERENCES `interview_tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `interview_questions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`interview_note_id` integer NOT NULL,
	`question` text NOT NULL,
	`my_answer` text DEFAULT '' NOT NULL,
	`better_answer` text DEFAULT '' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`interview_note_id`) REFERENCES `interview_notes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `interview_tags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `interview_tags_slug_unique` ON `interview_tags` (`slug`);