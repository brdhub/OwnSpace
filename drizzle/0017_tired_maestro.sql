ALTER TABLE `recruitment_opportunities` ADD `target_audience` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `recruitment_opportunities` ADD `degree` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `recruitment_opportunities` ADD `deadline` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `recruitment_opportunities` ADD `notes` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `recruitment_opportunities` ADD `written_test_waived` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `recruitment_opportunities` ADD `announcement_url` text;