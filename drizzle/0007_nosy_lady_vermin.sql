CREATE TABLE `resource_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`resource_id` text NOT NULL,
	`user_email` text NOT NULL,
	`author_role` text NOT NULL,
	`body` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`resource_id`) REFERENCES `instructor_resources`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_email`) REFERENCES `users`(`email`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `resource_messages_resource_idx` ON `resource_messages` (`resource_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `instructor_profiles` ADD `profile_bio` text DEFAULT '' NOT NULL;