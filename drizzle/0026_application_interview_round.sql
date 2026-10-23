ALTER TABLE `application_status_events` ADD `interview_round` integer;--> statement-breakpoint
ALTER TABLE `applications` ADD `interview_round` integer;
--> statement-breakpoint
DROP TRIGGER `applications_status_created`;
--> statement-breakpoint
DROP TRIGGER `applications_status_changed`;
--> statement-breakpoint
CREATE TRIGGER `applications_status_created` AFTER INSERT ON `applications`
BEGIN
  INSERT INTO `application_status_events` (`application_id`, `from_status`, `to_status`, `interview_round`, `kind`, `occurred_at`)
  VALUES (NEW.`id`, NULL, NEW.`status`, CASE WHEN NEW.`status` = 'laterInterview' THEN NEW.`interview_round` ELSE NULL END, 'created', NEW.`created_at`);
END;
--> statement-breakpoint
CREATE TRIGGER `applications_status_changed` AFTER UPDATE OF `status`, `interview_round` ON `applications`
WHEN OLD.`status` <> NEW.`status` OR (NEW.`status` = 'laterInterview' AND OLD.`interview_round` IS NOT NEW.`interview_round`)
BEGIN
  INSERT INTO `application_status_events` (`application_id`, `from_status`, `to_status`, `interview_round`, `kind`, `occurred_at`)
  VALUES (NEW.`id`, OLD.`status`, NEW.`status`, CASE WHEN NEW.`status` = 'laterInterview' THEN NEW.`interview_round` ELSE NULL END, 'changed', NEW.`updated_at`);
END;
