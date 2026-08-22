ALTER TABLE `applications` ADD `job_description` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `resume_optimization_tasks` ADD `application_id` integer REFERENCES applications(id) ON DELETE SET NULL;--> statement-breakpoint
CREATE INDEX `resume_optimization_tasks_application_id_idx` ON `resume_optimization_tasks` (`application_id`);
