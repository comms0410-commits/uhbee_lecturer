CREATE TABLE `instructor_profiles` (
	`user_email` text PRIMARY KEY NOT NULL,
	`grade` text DEFAULT '연습강사' NOT NULL,
	`contract_status` text DEFAULT '계약 완료' NOT NULL,
	`settlement_rate` integer DEFAULT 50 NOT NULL,
	`specialty` text DEFAULT '전문 분야 등록 전' NOT NULL,
	`manager_name` text DEFAULT '이수민 매니저' NOT NULL,
	`manager_email` text DEFAULT 'support@ubii.co.kr' NOT NULL,
	FOREIGN KEY (`user_email`) REFERENCES `users`(`email`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `lesson_plans` (
	`user_email` text PRIMARY KEY NOT NULL,
	`content` text DEFAULT '{}' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`reviewer_comment` text,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_email`) REFERENCES `users`(`email`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `onboarding_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`user_email` text NOT NULL,
	`stage` integer NOT NULL,
	`title` text NOT NULL,
	`category` text NOT NULL,
	`status` text DEFAULT 'not_started' NOT NULL,
	`due_date` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_email`) REFERENCES `users`(`email`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `student_issues` (
	`id` text PRIMARY KEY NOT NULL,
	`user_email` text NOT NULL,
	`severity` integer NOT NULL,
	`category` text NOT NULL,
	`course_name` text NOT NULL,
	`detail` text NOT NULL,
	`immediate_action` text DEFAULT '' NOT NULL,
	`evidence_url` text,
	`status` text DEFAULT 'reported' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_email`) REFERENCES `users`(`email`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`email` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`role` text DEFAULT 'instructor' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
