CREATE UNIQUE INDEX `resume_optimization_materials_id_task_id_unique` ON `resume_optimization_materials` (`id`,`task_id`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_resume_optimization_suggestions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`task_id` integer NOT NULL,
	`material_id` integer NOT NULL,
	`original_text` text NOT NULL,
	`proposed_text` text NOT NULL,
	`rationale` text NOT NULL,
	`state` text DEFAULT 'pending' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `resume_optimization_tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`material_id`) REFERENCES `resume_optimization_materials`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`material_id`,`task_id`) REFERENCES `resume_optimization_materials`(`id`,`task_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_resume_optimization_suggestions`("id", "task_id", "material_id", "original_text", "proposed_text", "rationale", "state", "sort_order", "created_at", "updated_at") SELECT "id", "task_id", "material_id", "original_text", "proposed_text", "rationale", "state", "sort_order", "created_at", "updated_at" FROM `resume_optimization_suggestions`;--> statement-breakpoint
DROP TABLE `resume_optimization_suggestions`;--> statement-breakpoint
ALTER TABLE `__new_resume_optimization_suggestions` RENAME TO `resume_optimization_suggestions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;