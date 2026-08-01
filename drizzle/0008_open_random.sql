CREATE TABLE `interview_note_tags` (
	`interview_note_id` integer NOT NULL,
	`interview_tag_id` integer NOT NULL,
	PRIMARY KEY(`interview_note_id`, `interview_tag_id`),
	FOREIGN KEY (`interview_note_id`) REFERENCES `interview_notes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`interview_tag_id`) REFERENCES `interview_tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT OR IGNORE INTO `interview_note_tags` (`interview_note_id`, `interview_tag_id`)
SELECT DISTINCT `interview_questions`.`interview_note_id`, `interview_question_tags`.`interview_tag_id`
FROM `interview_question_tags`
INNER JOIN `interview_questions`
  ON `interview_questions`.`id` = `interview_question_tags`.`interview_question_id`;