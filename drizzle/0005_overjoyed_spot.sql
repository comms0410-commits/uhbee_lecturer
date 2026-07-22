CREATE TABLE `course_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_email` text NOT NULL,
	`course_title` text NOT NULL,
	`free_lecture_date` text NOT NULL,
	`curriculum_date` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_email`) REFERENCES `users`(`email`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `course_runs_user_idx` ON `course_runs` (`user_email`,`created_at`);--> statement-breakpoint
CREATE TABLE `support_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`user_email` text NOT NULL,
	`request_type` text NOT NULL,
	`message` text NOT NULL,
	`admin_reply` text,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`replied_at` text,
	FOREIGN KEY (`user_email`) REFERENCES `users`(`email`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `support_requests_user_idx` ON `support_requests` (`user_email`,`created_at`);--> statement-breakpoint
CREATE TABLE `task_progress_updates` (
	`id` text PRIMARY KEY NOT NULL,
	`user_email` text NOT NULL,
	`task_id` text NOT NULL,
	`progress_note` text NOT NULL,
	`question` text DEFAULT '' NOT NULL,
	`admin_reply` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`replied_at` text,
	FOREIGN KEY (`user_email`) REFERENCES `users`(`email`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`task_id`) REFERENCES `onboarding_tasks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `task_progress_user_idx` ON `task_progress_updates` (`user_email`,`created_at`);--> statement-breakpoint
UPDATE `instructor_profiles` SET `manager_name` = '매니저' WHERE `manager_name` = '이수민 매니저';--> statement-breakpoint
ALTER TABLE `instructor_resources` ADD `placement` text DEFAULT 'library' NOT NULL;--> statement-breakpoint
ALTER TABLE `instructor_resources` ADD `stage` integer;--> statement-breakpoint
ALTER TABLE `lesson_plans` ADD `review_checklist` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `student_issues` ADD `admin_action` text;--> statement-breakpoint
ALTER TABLE `student_issues` ADD `admin_reply` text;--> statement-breakpoint
ALTER TABLE `student_issues` ADD `updated_at` text;
