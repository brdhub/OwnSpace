CREATE TABLE `applications` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `company` text NOT NULL,
  `role` text NOT NULL,
  `source` text NOT NULL,
  `status` text DEFAULT 'planned' NOT NULL,
  `applied_date` text NOT NULL,
  `notes` text DEFAULT '' NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `daily_actions` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `action_date` text NOT NULL,
  `title` text NOT NULL,
  `completed` integer DEFAULT false NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `daily_actions_action_date_unique` ON `daily_actions` (`action_date`);
