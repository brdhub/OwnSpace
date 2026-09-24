CREATE TABLE `application_status_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`application_id` integer NOT NULL,
	`from_status` text,
	`to_status` text NOT NULL,
	`kind` text NOT NULL,
	`occurred_at` text NOT NULL,
	FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `application_status_events_application_id_idx` ON `application_status_events` (`application_id`,`id`);
--> statement-breakpoint
INSERT INTO `application_status_events` (`application_id`, `from_status`, `to_status`, `kind`, `occurred_at`)
SELECT `id`, NULL, `status`, 'baseline', strftime('%Y-%m-%dT%H:%M:%fZ', 'now') FROM `applications`;
--> statement-breakpoint
CREATE TRIGGER `applications_status_created` AFTER INSERT ON `applications`
BEGIN
  INSERT INTO `application_status_events` (`application_id`, `from_status`, `to_status`, `kind`, `occurred_at`)
  VALUES (NEW.`id`, NULL, NEW.`status`, 'created', NEW.`created_at`);
END;
--> statement-breakpoint
CREATE TRIGGER `applications_status_changed` AFTER UPDATE OF `status` ON `applications`
WHEN OLD.`status` <> NEW.`status`
BEGIN
  INSERT INTO `application_status_events` (`application_id`, `from_status`, `to_status`, `kind`, `occurred_at`)
  VALUES (NEW.`id`, OLD.`status`, NEW.`status`, 'changed', NEW.`updated_at`);
END;
