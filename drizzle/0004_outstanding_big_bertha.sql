CREATE TABLE `journal_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`entry_date` text NOT NULL,
	`content` text NOT NULL,
	`mood` text,
	`energy_level` text,
	`completed_today` text DEFAULT '' NOT NULL,
	`tomorrow_minimum_action` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `journal_entries_entry_date_unique` ON `journal_entries` (`entry_date`);