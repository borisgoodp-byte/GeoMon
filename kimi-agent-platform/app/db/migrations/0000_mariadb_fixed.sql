CREATE TABLE `collection_configs` (
	`projectId` bigint unsigned NOT NULL,
	`frequency` enum('daily','workdays','custom') NOT NULL DEFAULT 'daily',
	`customDays` json,
	`platforms` json NOT NULL,
	`assignee` varchar(64),
	`competitorSync` boolean NOT NULL DEFAULT true,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `collection_configs_projectId` PRIMARY KEY(`projectId`)
);
--> statement-breakpoint
CREATE TABLE `competitor_hits` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`projectId` bigint unsigned NOT NULL,
	`keywordId` bigint unsigned NOT NULL,
	`competitorId` bigint unsigned NOT NULL,
	`platform` enum('deepseek','doubao','qwen') NOT NULL,
	`date` date NOT NULL,
	`level` enum('L2','L1','L0') NOT NULL,
	`url` varchar(1024),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `competitor_hits_id` PRIMARY KEY(`id`),
	CONSTRAINT `comp_hit_unique` UNIQUE(`keywordId`,`competitorId`,`platform`,`date`)
);
--> statement-breakpoint
CREATE TABLE `competitors` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`projectId` bigint unsigned NOT NULL,
	`name` varchar(255) NOT NULL,
	`domain` varchar(255) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `competitors_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `crawl_results` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`diagnosticId` bigint unsigned NOT NULL,
	`targetUrl` varchar(512) NOT NULL,
	`status` enum('ok','partial','failed') NOT NULL,
	`summaryJson` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `crawl_results_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `diagnostics` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`projectId` bigint unsigned NOT NULL,
	`diagnoseDate` date NOT NULL,
	`status` enum('crawling','scoring','completed') NOT NULL DEFAULT 'crawling',
	`techScore` decimal(5,1),
	`archScore` decimal(5,1),
	`contentScore` decimal(5,1),
	`visScore` decimal(5,1),
	`compositeScore` decimal(5,1),
	`grade` varchar(2),
	`verdictJson` json,
	`directionsJson` json,
	`visTests` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `diagnostics_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `findings` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`diagnosticId` bigint unsigned NOT NULL,
	`dimension` int NOT NULL,
	`severity` enum('danger','warn','ok') NOT NULL,
	`title` varchar(500) NOT NULL,
	`body` text NOT NULL,
	`impact` text NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	CONSTRAINT `findings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `indicator_scores` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`diagnosticId` bigint unsigned NOT NULL,
	`indicatorKey` varchar(32) NOT NULL,
	`dimension` int NOT NULL,
	`score` int,
	`autoScore` int,
	`autoEvidence` text,
	`evidence` text,
	CONSTRAINT `indicator_scores_id` PRIMARY KEY(`id`),
	CONSTRAINT `diag_indicator_unique` UNIQUE(`diagnosticId`,`indicatorKey`)
);
--> statement-breakpoint
CREATE TABLE `keyword_pools` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`projectId` bigint unsigned NOT NULL,
	`name` varchar(255) NOT NULL,
	`version` int NOT NULL DEFAULT 1,
	`status` enum('draft','locked') NOT NULL DEFAULT 'draft',
	`lockedAt` timestamp,
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `keyword_pools_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `keywords` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`poolId` bigint unsigned NOT NULL,
	`text` varchar(500) NOT NULL,
	`category` enum('brand','generic','scenario') NOT NULL,
	`isExtended` boolean NOT NULL DEFAULT false,
	`status` enum('active','removed') NOT NULL DEFAULT 'active',
	`addedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `keywords_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `measurements` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`projectId` bigint unsigned NOT NULL,
	`poolId` bigint unsigned NOT NULL,
	`keywordId` bigint unsigned NOT NULL,
	`measureDate` date NOT NULL,
	`platform` enum('deepseek','doubao','qwen') NOT NULL,
	`level` enum('L2','L1','L0') NOT NULL,
	`citedUrl` text,
	`citedUrlNorm` varchar(768),
	`citedPageTitle` varchar(500),
	`snapshot` text,
	`isCheckpoint` boolean NOT NULL DEFAULT false,
	`checkpointTag` enum('m6','m12'),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `measurements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pool_change_logs` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`poolId` bigint unsigned NOT NULL,
	`action` enum('create','lock','unlock','add','remove','extend') NOT NULL,
	`detail` text NOT NULL,
	`operator` varchar(128) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `pool_change_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`company` varchar(255) NOT NULL,
	`domain` varchar(255) NOT NULL,
	`industry` varchar(128) NOT NULL,
	`serviceTier` enum('basic','standard','premium') NOT NULL DEFAULT 'standard',
	`serviceMonths` int NOT NULL DEFAULT 12,
	`stage` enum('A','B','C','D') NOT NULL DEFAULT 'A',
	`startDate` date,
	`owner` varchar(128),
	`note` text,
	`status` enum('active','archived') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `projects_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quotes` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`projectId` bigint unsigned NOT NULL,
	`title` varchar(255) NOT NULL,
	`tier` varchar(32) NOT NULL,
	`itemsJson` json NOT NULL,
	`totalPrice` decimal(12,2) NOT NULL,
	`status` enum('draft','issued') NOT NULL DEFAULT 'draft',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `quotes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `schedules` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`projectId` bigint unsigned NOT NULL,
	`startDate` date NOT NULL,
	`phasesJson` json NOT NULL,
	`milestonesJson` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `schedules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`token` varchar(64) NOT NULL,
	`userId` bigint unsigned NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sessions_token` PRIMARY KEY(`token`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`username` varchar(64) NOT NULL,
	`passwordHash` varchar(255) NOT NULL,
	`displayName` varchar(64) NOT NULL,
	`role` enum('admin','operator','client') NOT NULL,
	`projectId` bigint unsigned,
	`status` enum('active','disabled') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_username_unique` UNIQUE(`username`)
);
--> statement-breakpoint
ALTER TABLE `collection_configs` ADD CONSTRAINT `collection_configs_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `comp_hit_project_date_idx` ON `competitor_hits` (`projectId`,`date`);--> statement-breakpoint
CREATE INDEX `comp_hit_competitor_idx` ON `competitor_hits` (`competitorId`);--> statement-breakpoint
CREATE INDEX `comp_project_idx` ON `competitors` (`projectId`);--> statement-breakpoint
CREATE INDEX `crawl_diag_idx` ON `crawl_results` (`diagnosticId`);--> statement-breakpoint
CREATE INDEX `diag_project_idx` ON `diagnostics` (`projectId`);--> statement-breakpoint
CREATE INDEX `findings_diag_idx` ON `findings` (`diagnosticId`);--> statement-breakpoint
CREATE INDEX `pool_project_idx` ON `keyword_pools` (`projectId`);--> statement-breakpoint
CREATE INDEX `kw_pool_idx` ON `keywords` (`poolId`);--> statement-breakpoint
CREATE INDEX `ms_project_date_idx` ON `measurements` (`projectId`,`measureDate`);--> statement-breakpoint
CREATE INDEX `ms_pool_idx` ON `measurements` (`poolId`);--> statement-breakpoint
CREATE INDEX `ms_keyword_idx` ON `measurements` (`keywordId`);--> statement-breakpoint
CREATE INDEX `log_pool_idx` ON `pool_change_logs` (`poolId`);--> statement-breakpoint
CREATE INDEX `quote_project_idx` ON `quotes` (`projectId`);--> statement-breakpoint
CREATE INDEX `sched_project_idx` ON `schedules` (`projectId`);--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`userId`);