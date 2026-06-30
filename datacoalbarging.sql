-- Database structure for Coal Barging module.
-- Coal Barging reads raw SI Barges and TLU operation data from `databarging`,
-- then stores Coal-specific edits here so TLU Operation remains unchanged.

CREATE DATABASE IF NOT EXISTS `datacoalbarging`
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `datacoalbarging`;

DROP TABLE IF EXISTS `coal_barge_operations`;
DROP TABLE IF EXISTS `coal_barge_rc_rows`;
DROP TABLE IF EXISTS `coal_barge_deleted_rows`;

CREATE TABLE `coal_barge_operations` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `sibarges_id` bigint unsigned NOT NULL,
  `operation_data` json DEFAULT NULL,
  `remarks` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `created_by` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_coal_barge_operations_sibarges` (`sibarges_id`),
  KEY `idx_coal_barge_operations_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `coal_barge_rc_rows` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `source_sibarges_id` bigint unsigned NOT NULL,
  `usage_status` enum('used','unused') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'used',
  `operation_data` json DEFAULT NULL,
  `remarks` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `created_by` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_coal_barge_rc_usage_status` (`usage_status`),
  KEY `idx_coal_barge_rc_source_sibarges` (`source_sibarges_id`),
  KEY `idx_coal_barge_rc_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `coal_barge_deleted_rows` (
  `sibarges_id` bigint unsigned NOT NULL,
  `deleted_by` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `deleted_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`sibarges_id`),
  KEY `idx_coal_barge_deleted_at` (`deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
