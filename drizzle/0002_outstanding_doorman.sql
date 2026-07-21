CREATE TABLE `instructor_resources` (
	`id` text PRIMARY KEY NOT NULL,
	`target_email` text NOT NULL,
	`title` text NOT NULL,
	`resource_type` text DEFAULT '전자책' NOT NULL,
	`request_note` text DEFAULT '' NOT NULL,
	`delivery_type` text NOT NULL,
	`external_url` text,
	`object_key` text,
	`file_name` text,
	`mime_type` text,
	`size_bytes` integer,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`target_email`) REFERENCES `users`(`email`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`email`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `instructor_resources_target_idx` ON `instructor_resources` (`target_email`,`created_at`);