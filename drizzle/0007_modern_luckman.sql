CREATE TABLE `planning_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`event_date` text NOT NULL,
	`event_type` text NOT NULL,
	`status` text DEFAULT 'todo' NOT NULL,
	`source` text DEFAULT 'user' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT `planning_events_title_not_blank` CHECK (length(trim(`title`)) > 0),
	CONSTRAINT `planning_events_date_range` CHECK (`event_date` >= '2026-07-01' and `event_date` <= '2027-06-30'),
	CONSTRAINT `planning_events_type_check` CHECK (`event_type` in ('task', 'progress')),
	CONSTRAINT `planning_events_status_check` CHECK (`status` in ('todo', 'inProgress', 'done', 'archived')),
	CONSTRAINT `planning_events_source_check` CHECK (`source` in ('system', 'user'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `planning_events_system_event_unique` ON `planning_events` (`source`,`event_date`,`title`);
