CREATE TABLE `resume_entry_merges` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`entry_id` integer NOT NULL,
	`candidate_id` integer,
	`before_json` text NOT NULL,
	`after_json` text NOT NULL,
	`source_excerpt` text NOT NULL,
	`created_at` text NOT NULL,
	`undone_at` text,
	FOREIGN KEY (`entry_id`) REFERENCES `resume_entries`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`candidate_id`) REFERENCES `resume_entry_candidates`(`id`) ON UPDATE no action ON DELETE set null
);
