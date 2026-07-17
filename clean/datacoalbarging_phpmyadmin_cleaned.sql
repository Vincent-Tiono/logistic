CREATE DATABASE IF NOT EXISTS `datacoalbarging` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `datacoalbarging`;

-- MySQL dump 10.13  Distrib 9.6.0, for macos26.4 (arm64)
--
-- Host: 127.0.0.1    Database: datacoalbarging
-- ------------------------------------------------------
-- Server version	8.0.41

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Current Database: `datacoalbarging`
--

--
-- Table structure for table `coal_barge_deleted_rows`
--

DROP TABLE IF EXISTS `coal_barge_deleted_rows`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `coal_barge_deleted_rows` (
  `sibarges_id` bigint unsigned NOT NULL,
  `deleted_by` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `deleted_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`sibarges_id`),
  KEY `idx_coal_barge_deleted_at` (`deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `coal_barge_deleted_rows`
--

LOCK TABLES `coal_barge_deleted_rows` WRITE;
/*!40000 ALTER TABLE `coal_barge_deleted_rows` DISABLE KEYS */;
/*!40000 ALTER TABLE `coal_barge_deleted_rows` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `coal_barge_operations`
--

DROP TABLE IF EXISTS `coal_barge_operations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
) ENGINE=InnoDB AUTO_INCREMENT=78 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `coal_barge_operations`
--

LOCK TABLES `coal_barge_operations` WRITE;
/*!40000 ALTER TABLE `coal_barge_operations` DISABLE KEYS */;
INSERT INTO `coal_barge_operations` VALUES (37,22,'{\"rc\": \"0\", \"lhv\": \"2026-05-24 08:52\", \"pkk\": \"2026-05-25 19:15\", \"qty\": \"8,203\", \"rkbm\": \"2026-05-26 19:31\", \"ta_mv\": \"2026-05-28 15:00\", \"ta_flf\": \"2026-05-29 07:00\", \"sts_spb\": \"2026-05-26 21:29\", \"qty_disc\": \"8,203\", \"clear_pass\": \"2026-05-25 12:20\", \"pbm_vendor\": \"PSS\", \"qty_actual\": \"8203\", \"end_mooring\": \"2026-05-25 10:30\", \"spog_zona_2\": \"2026-05-24 21:28\", \"start_disch\": \"2026-05-29 05:40\", \"arrival_jetty\": \"2026-05-23 20:00\", \"back_to_jetty\": \"2026-05-30 16:50\", \"start_loading\": \"2026-05-23 21:35\", \"start_mooring\": \"2026-05-24 04:20\", \"floating_crane\": \"FC RATU DEWATA\", \"completed_disch\": \"2026-05-29 17:10\", \"mooring_place_1\": \"TAMBATAN JEMBAYAN, H BARU\", \"mooring_place_2\": \"TAMBATAN PALARAN, PASSING P BUAYA\", \"ta_barges_actual\": \"2026-05-27 11:00\", \"completed_loading\": \"2026-05-24 03:25\", \"discharge_sequence\": \"1\", \"cargo_readiness_actual\": \"2026-05-27 11:00\", \"start_mooring_clear_pass\": \"2026-05-25 14:00\", \"cast_off_mooring_clear_pass\": \"2026-05-26 07:30\"}','','admin','2026-06-18 08:58:18','2026-06-19 02:09:21'),(38,33,'{\"rc\": \"0\", \"lhv\": \"2026-05-24 17:49\", \"pkk\": \"2026-05-25 19:15\", \"qty\": \"8,101\", \"rkbm\": \"2026-05-26 19:31\", \"ta_mv\": \"2026-05-28 15:00\", \"ta_flf\": \"2026-05-29 07:00\", \"sts_spb\": \"2026-05-30 16:35\", \"qty_disc\": \"8,101\", \"clear_pass\": \"2026-05-25 15:25\", \"pbm_vendor\": \"PSS\", \"qty_actual\": \"8101\", \"end_mooring\": \"2026-05-25 12:45\", \"spog_zona_2\": \"2026-05-24 23:15\", \"start_disch\": \"2026-05-30 04:45\", \"arrival_jetty\": \"2026-05-21 21:15\", \"back_to_jetty\": \"2026-05-31 17:35\", \"start_loading\": \"2026-05-24 04:05\", \"start_mooring\": \"2026-05-24 13:30\", \"floating_crane\": \"FC RATU DEWATA\", \"completed_disch\": \"2026-05-30 13:10\", \"mooring_place_1\": \"TAMBATAN COBRA\", \"mooring_place_2\": \"PASSING P BUAYA\", \"ta_barges_actual\": \"2026-05-27 01:30\", \"completed_loading\": \"2026-05-24 10:55\", \"discharge_sequence\": \"5\", \"cargo_readiness_actual\": \"2026-05-27 11:00\", \"start_mooring_clear_pass\": \"2026-05-25 18:10\"}','','admin','2026-06-18 10:04:05','2026-06-19 02:09:40'),(39,34,'{\"rc\": \"1,001\", \"lhv\": \"2026-05-25 11:48\", \"pkk\": \"2026-05-25 19:15\", \"qty\": \"7,002\", \"rkbm\": \"2026-05-26 19:31\", \"ta_mv\": \"2026-05-28 15:00\", \"ta_flf\": \"2026-05-29 07:00\", \"sts_spb\": \"2026-05-30 16:54\", \"qty_disc\": \"7,002\", \"clear_pass\": \"2026-05-27 17:20\", \"pbm_vendor\": \"PSS\", \"qty_actual\": \"8003\", \"end_mooring\": \"2026-05-27 12:50\", \"spog_zona_2\": \"2026-05-25 20:12\", \"start_disch\": \"2026-05-31 08:15\", \"arrival_jetty\": \"2026-05-24 23:00\", \"back_to_jetty\": \"2026-06-01 19:00\", \"start_loading\": \"2026-05-25 03:40\", \"start_mooring\": \"2026-05-25 16:10\", \"floating_crane\": \"FC RATU DEWATA\", \"completed_disch\": \"2026-05-31 16:20\", \"mooring_place_1\": \"TAMBATAN LOA DURI\", \"mooring_place_2\": \"PASSING P BUAYA\", \"ta_barges_actual\": \"2026-05-29 07:00\", \"completed_loading\": \"2026-05-25 09:55\", \"discharge_sequence\": \"8\", \"cargo_readiness_actual\": \"2026-05-27 11:00\", \"start_mooring_clear_pass\": \"2026-05-27 19:15\"}','','admin','2026-06-18 10:04:05','2026-06-19 02:10:24'),(40,35,'{\"rc\": \"0\", \"lhv\": \"2026-05-24 22:00\", \"pkk\": \"2026-05-25 19:15\", \"qty\": \"7,002\", \"rkbm\": \"2026-05-26 19:31\", \"ta_mv\": \"2026-05-28 15:00\", \"ta_flf\": \"2026-05-29 07:00\", \"sts_spb\": \"2026-05-31 07:15\", \"qty_disc\": \"7,002\", \"clear_pass\": \"2026-05-25 15:20\", \"pbm_vendor\": \"PSS\", \"qty_actual\": \"7002\", \"end_mooring\": \"2026-05-25 13:00\", \"spog_zona_2\": \"2026-05-25 07:20\", \"start_disch\": \"2026-05-30 23:40\", \"arrival_jetty\": \"2026-05-16 08:00\", \"back_to_jetty\": \"2026-06-01 07:05\", \"start_loading\": \"2026-05-24 13:00\", \"start_mooring\": \"2026-05-24 19:00\", \"floating_crane\": \"FC RATU DEWATA\", \"completed_disch\": \"2026-05-31 07:05\", \"mooring_place_1\": \"TAMBATAN COBRA\", \"mooring_place_2\": \"PASSING P BUAYA\", \"ta_barges_actual\": \"2026-05-27 04:30\", \"completed_loading\": \"2026-05-24 16:50\", \"discharge_sequence\": \"6\", \"cargo_readiness_actual\": \"2026-05-27 11:00\", \"start_mooring_clear_pass\": \"2026-05-25 18:00\"}','','admin','2026-06-18 10:04:05','2026-06-19 02:10:44'),(41,36,'{\"rc\": \"0\", \"lhv\": \"2026-05-24 15:51\", \"pkk\": \"2026-05-25 19:15\", \"qty\": \"8,001\", \"rkbm\": \"2026-05-26 19:31\", \"ta_mv\": \"2026-05-28 15:00\", \"ta_flf\": \"2026-05-29 07:00\", \"sts_spb\": \"2026-05-29 02:10\", \"qty_disc\": \"8,001\", \"clear_pass\": \"2026-05-25 15:30\", \"pbm_vendor\": \"PSS\", \"qty_actual\": \"8001\", \"end_mooring\": \"2026-05-25 11:15\", \"spog_zona_2\": \"2026-05-25 08:45\", \"start_disch\": \"2026-05-29 05:40\", \"arrival_jetty\": \"2026-05-17 04:10\", \"back_to_jetty\": \"2026-05-30 17:00\", \"start_loading\": \"2026-05-23 02:20\", \"start_mooring\": \"2026-05-24 14:30\", \"floating_crane\": \"FC RATU DEWATA\", \"completed_disch\": \"2026-05-29 17:10\", \"mooring_place_1\": \"TAMBATAN COBRA\", \"mooring_place_2\": \"PASSING P BUAYA\", \"ta_barges_actual\": \"2026-05-27 02:40\", \"completed_loading\": \"2026-05-24 12:00\", \"discharge_sequence\": \"2\", \"cargo_readiness_actual\": \"2026-05-27 11:00\", \"start_mooring_clear_pass\": \"2026-05-25 17:45\"}','','admin','2026-06-18 10:04:05','2026-06-19 02:10:56'),(42,37,'{\"rc\": \"0\", \"lhv\": \"2026-05-25 09:30\", \"pkk\": \"2026-05-25 19:15\", \"qty\": \"8,001\", \"rkbm\": \"2026-05-26 19:31\", \"ta_mv\": \"2026-05-28 15:00\", \"ta_flf\": \"2026-05-29 07:00\", \"sts_spb\": \"2026-05-30 16:35\", \"qty_disc\": \"8,001\", \"clear_pass\": \"2026-05-29 07:35\", \"pbm_vendor\": \"PSS\", \"qty_actual\": \"8001\", \"end_mooring\": \"2026-05-29 04:30\", \"spog_zona_2\": \"2026-05-25 09:45\", \"start_disch\": \"2026-05-31 17:50\", \"arrival_jetty\": \"2026-05-17 19:45\", \"back_to_jetty\": \"2026-06-02 18:00\", \"start_loading\": \"2026-05-24 13:35\", \"start_mooring\": \"2026-05-25 02:00\", \"floating_crane\": \"FC RATU DEWATA\", \"completed_disch\": \"2026-06-01 04:25\", \"mooring_place_1\": \"TAMBATAN JEMBAYAN\", \"mooring_place_2\": \"PASSING P BUAYA\", \"ta_barges_actual\": \"2026-05-30 18:30\", \"completed_loading\": \"2026-05-24 23:25\", \"discharge_sequence\": \"9\", \"cargo_readiness_actual\": \"2026-05-27 11:00\", \"start_mooring_clear_pass\": \"2026-05-29 09:50\"}','','admin','2026-06-18 10:04:05','2026-06-19 02:11:14'),(43,38,'{\"rc\": \"0\", \"lhv\": \"2026-05-24 16:50\", \"pkk\": \"2026-05-25 19:15\", \"qty\": \"8,002\", \"rkbm\": \"2026-05-26 19:31\", \"ta_mv\": \"2026-05-28 15:00\", \"ta_flf\": \"2026-05-29 07:00\", \"sts_spb\": \"2026-05-30 16:35\", \"qty_disc\": \"8,002\", \"clear_pass\": \"2026-05-25 15:55\", \"pbm_vendor\": \"PSS\", \"qty_actual\": \"8002\", \"end_mooring\": \"2026-05-25 13:00\", \"spog_zona_2\": \"2026-05-25 07:20\", \"start_disch\": \"2026-05-29 18:50\", \"arrival_jetty\": \"2026-05-16 16:50\", \"back_to_jetty\": \"2026-05-31 17:10\", \"start_loading\": \"2026-05-23 21:35\", \"start_mooring\": \"2026-05-24 18:20\", \"floating_crane\": \"FC RATU DEWATA\", \"completed_disch\": \"2026-05-30 13:10\", \"mooring_place_1\": \"TAMBATAN JEMBAYAN\", \"mooring_place_2\": \"PASSING P BUAYA\", \"ta_barges_actual\": \"2026-05-27 10:00\", \"completed_loading\": \"2026-05-24 03:25\", \"discharge_sequence\": \"4\", \"cargo_readiness_actual\": \"2026-05-27 11:00\", \"start_mooring_clear_pass\": \"2026-05-25 18:50\"}','','admin','2026-06-18 10:04:05','2026-06-19 02:11:24'),(44,39,'{\"rc\": \"0\", \"lhv\": \"2026-05-26 06:58\", \"pkk\": \"2026-05-25 19:15\", \"qty\": \"7,402\", \"rkbm\": \"2026-05-26 19:31\", \"ta_mv\": \"2026-05-28 15:00\", \"ta_flf\": \"2026-05-29 07:00\", \"sts_spb\": \"2026-05-30 16:35\", \"qty_disc\": \"7,169\", \"clear_pass\": \"2026-05-27 16:45\", \"pbm_vendor\": \"PSS\", \"qty_actual\": \"7162\", \"end_mooring\": \"2026-05-27 15:00\", \"spog_zona_2\": \"2026-05-26 16:00\", \"start_disch\": \"2026-05-31 17:50\", \"arrival_jetty\": \"2026-05-25 13:00\", \"back_to_jetty\": \"2026-06-02 18:00\", \"start_loading\": \"2026-05-25 15:50\", \"start_mooring\": \"2026-05-25 22:15\", \"status_act_rc\": \"ACT\", \"floating_crane\": \"FC RATU DEWATA\", \"completed_disch\": \"2026-06-01 04:25\", \"mooring_place_1\": \"TAMBATAN COBRA\", \"mooring_place_2\": \"TAMBATAN P ATAS, PASING P BUAYA\", \"ta_barges_actual\": \"2026-05-29 08:00\", \"completed_loading\": \"2026-05-25 20:25\", \"status_act_act_rc\": \"ACT&RC\", \"discharge_sequence\": \"10\", \"cargo_readiness_actual\": \"2026-05-27 11:00\", \"start_mooring_clear_pass\": \"2026-05-27 19:00\", \"cast_off_mooring_clear_pass\": \"2026-05-28 01:00\"}','','admin','2026-06-18 10:04:05','2026-07-01 08:23:41'),(45,40,'{\"rc\": \"0\", \"lhv\": \"2026-05-26 20:23\", \"pkk\": \"2026-05-25 19:15\", \"qty\": \"8,001\", \"rkbm\": \"2026-05-26 19:31\", \"ta_mv\": \"2026-05-28 15:00\", \"ta_flf\": \"2026-05-29 07:00\", \"sts_spb\": \"2026-05-30 16:20\", \"qty_disc\": \"8,001\", \"clear_pass\": \"2026-05-27 18:17\", \"pbm_vendor\": \"PSS\", \"qty_actual\": \"8001\", \"end_mooring\": \"2026-05-27 15:30\", \"spog_zona_2\": \"2026-05-27 09:10\", \"start_disch\": \"2026-05-29 18:50\", \"arrival_jetty\": \"2026-05-22 20:00\", \"back_to_jetty\": \"2026-05-31 17:00\", \"start_loading\": \"2026-05-26 13:30\", \"start_mooring\": \"2026-05-26 20:35\", \"floating_crane\": \"FC RATU DEWATA\", \"completed_disch\": \"2026-05-30 03:55\", \"mooring_place_1\": \"TAMBATAN LOA DURI\", \"mooring_place_2\": \"PASSING P BUAYA\", \"ta_barges_actual\": \"2026-05-29 10:00\", \"completed_loading\": \"2026-05-26 18:25\", \"discharge_sequence\": \"3\", \"cargo_readiness_actual\": \"2026-05-27 11:00\", \"start_mooring_clear_pass\": \"2026-05-27 20:20\"}','','admin','2026-06-18 10:04:05','2026-06-19 02:11:48'),(46,41,'{\"rc\": \"0\", \"lhv\": \"2026-05-26 10:54\", \"pkk\": \"2026-05-25 19:15\", \"qty\": \"8,002\", \"rkbm\": \"2026-05-26 19:31\", \"ta_mv\": \"2026-05-28 15:00\", \"ta_flf\": \"2026-05-29 07:00\", \"sts_spb\": \"2026-05-30 16:05\", \"qty_disc\": \"8,002\", \"clear_pass\": \"2026-05-28 15:40\", \"pbm_vendor\": \"PSS\", \"qty_actual\": \"8002\", \"end_mooring\": \"2026-05-28 15:10\", \"spog_zona_2\": \"2026-05-26 19:43\", \"start_disch\": \"2026-05-30 23:40\", \"arrival_jetty\": \"2026-05-18 17:40\", \"back_to_jetty\": \"2026-06-01 18:10\", \"start_loading\": \"2026-05-25 19:40\", \"start_mooring\": \"2026-05-26 10:20\", \"floating_crane\": \"FC RATU DEWATA\", \"completed_disch\": \"2026-05-31 16:20\", \"mooring_place_1\": \"TAMBATAN JEMBAYAN\", \"mooring_place_2\": \"PASSING P BUAYA\", \"ta_barges_actual\": \"2026-05-30 20:50\", \"completed_loading\": \"2026-05-26 09:40\", \"discharge_sequence\": \"7\", \"cargo_readiness_actual\": \"2026-05-27 11:00\", \"start_mooring_clear_pass\": \"2026-05-28 18:20\"}','','admin','2026-06-18 10:04:05','2026-06-19 02:12:00'),(69,42,'{\"rc\": \"0\", \"lhv\": \"2026-06-07 13:25\", \"pkk\": \"2026-06-09 14:43\", \"qty\": \"7,500\", \"rkbm\": \"2026-06-09 18:19\", \"ta_mv\": \"2026-06-10 12:00\", \"ta_flf\": \"2026-06-11 16:30\", \"sts_spb\": \"2026-06-09 15:26\", \"qty_disc\": \"7,500\", \"clear_pass\": \"2026-06-09 13:15\", \"pbm_vendor\": \"MLS\", \"qty_actual\": \"7500\", \"end_mooring\": \"2026-06-09 06:30\", \"spog_zona_2\": \"2026-06-09 06:04\", \"start_disch\": \"2026-06-14 18:50\", \"arrival_jetty\": \"2026-06-07 01:00\", \"back_to_jetty\": \"2026-06-16 06:30\", \"start_loading\": \"2026-06-07 02:05\", \"start_mooring\": \"2026-06-07 15:00\", \"floating_crane\": \"STV MAESTRO\", \"completed_disch\": \"2026-06-15 06:30\", \"mooring_place_1\": \"TAMBATAN KAILI\", \"mooring_place_2\": \"PASSING P BUAYA\", \"ta_barges_actual\": \"2026-06-11 16:30\", \"completed_loading\": \"2026-06-07 10:50\", \"discharge_sequence\": \"6\", \"cargo_readiness_actual\": \"2026-06-11 07:00\", \"start_mooring_clear_pass\": \"2026-06-09 16:30\"}','','admin','2026-06-29 09:46:04',NULL),(70,43,'{\"rc\": \"0\", \"lhv\": \"2026-06-07 13:37\", \"pkk\": \"2026-06-09 14:43\", \"qty\": \"9,800\", \"rkbm\": \"2026-06-09 18:19\", \"ta_mv\": \"2026-06-10 12:00\", \"ta_flf\": \"2026-06-11 16:30\", \"sts_spb\": \"2026-06-09 00:15\", \"qty_disc\": \"9,800\", \"clear_pass\": \"2026-06-09 12:40\", \"pbm_vendor\": \"MLS\", \"qty_actual\": \"9800\", \"end_mooring\": \"2026-06-09 09:15\", \"spog_zona_2\": \"2026-06-09 00:15\", \"start_disch\": \"2026-06-12 08:00\", \"arrival_jetty\": \"2026-05-31 20:30\", \"back_to_jetty\": \"2026-06-13 23:05\", \"start_loading\": \"2026-06-06 13:10\", \"start_mooring\": \"2026-06-07 01:15\", \"floating_crane\": \"STV MAESTRO\", \"completed_disch\": \"2026-06-12 23:05\", \"mooring_place_1\": \"TAMBATAN LOA JANAH\", \"mooring_place_2\": \"PASSING P BUAYA\", \"ta_barges_actual\": \"2026-06-11 07:00\", \"completed_loading\": \"2026-06-06 22:10\", \"discharge_sequence\": \"2\", \"cargo_readiness_actual\": \"2026-06-11 07:00\", \"start_mooring_clear_pass\": \"2026-06-09 16:30\"}','','admin','2026-06-29 09:46:04',NULL),(71,44,'{\"rc\": \"233\", \"lhv\": \"2026-06-07 16:44\", \"pkk\": \"2026-06-09 14:43\", \"qty\": \"6,267\", \"rkbm\": \"2026-06-09 18:19\", \"ta_mv\": \"2026-06-10 12:00\", \"ta_flf\": \"2026-06-11 16:30\", \"sts_spb\": \"2026-06-08 14:42\", \"qty_disc\": \"6,267\", \"clear_pass\": \"2026-06-09 13:20\", \"pbm_vendor\": \"MLS\", \"qty_actual\": \"6500\", \"end_mooring\": \"2026-06-09 07:15\", \"spog_zona_2\": \"2026-06-08 14:42\", \"start_disch\": \"2026-06-11 16:30\", \"arrival_jetty\": \"2026-06-02 17:00\", \"back_to_jetty\": \"2026-06-13 08:00\", \"start_loading\": \"2026-06-07 01:05\", \"start_mooring\": \"2026-06-07 16:25\", \"floating_crane\": \"STV MAESTRO\", \"completed_disch\": \"2026-06-12 08:00\", \"mooring_place_1\": \"TAMBATAN JEMBAYAN\", \"mooring_place_2\": \"TAMBATAN PULAU ATAS, PASSING P BUAYA\", \"ta_barges_actual\": \"2026-06-11 15:05\", \"completed_loading\": \"2026-06-07 14:40\", \"discharge_sequence\": \"1\", \"cargo_readiness_actual\": \"2026-06-11 07:00\", \"start_mooring_clear_pass\": \"2026-06-09 15:45\", \"cast_off_mooring_clear_pass\": \"2026-06-09 21:00\"}','','admin','2026-06-29 09:46:04',NULL),(72,45,'{\"rc\": \"0\", \"lhv\": \"2026-06-07 16:45\", \"pkk\": \"2026-06-09 14:43\", \"qty\": \"9,800\", \"rkbm\": \"2026-06-09 18:19\", \"ta_mv\": \"2026-06-10 12:00\", \"ta_flf\": \"2026-06-11 16:30\", \"sts_spb\": \"2026-06-09 00:14\", \"qty_disc\": \"9,800\", \"clear_pass\": \"2026-06-09 12:15\", \"pbm_vendor\": \"MLS\", \"qty_actual\": \"9800\", \"end_mooring\": \"2026-06-09 09:40\", \"spog_zona_2\": \"2026-06-09 00:14\", \"start_disch\": \"2026-06-13 15:10\", \"arrival_jetty\": \"2026-06-03 19:30\", \"back_to_jetty\": \"2026-06-15 07:00\", \"start_loading\": \"2026-06-07 07:10\", \"start_mooring\": \"2026-06-07 17:00\", \"floating_crane\": \"STV MAESTRO\", \"completed_disch\": \"2026-06-14 07:00\", \"mooring_place_1\": \"TAMBATAN LOA JANAH\", \"mooring_place_2\": \"PASSING P BUAYA\", \"ta_barges_actual\": \"2026-06-11 03:20\", \"completed_loading\": \"2026-06-07 15:15\", \"discharge_sequence\": \"4\", \"cargo_readiness_actual\": \"2026-06-11 07:00\", \"start_mooring_clear_pass\": \"2026-06-09 16:00\"}','','admin','2026-06-29 09:46:04',NULL),(73,46,'{\"rc\": \"0\", \"lhv\": \"2026-06-08 22:21\", \"pkk\": \"2026-06-09 14:43\", \"qty\": \"8,201\", \"rkbm\": \"2026-06-09 18:19\", \"ta_mv\": \"2026-06-10 12:00\", \"ta_flf\": \"2026-06-11 16:30\", \"sts_spb\": \"2026-06-09 15:15\", \"qty_disc\": \"8,201\", \"clear_pass\": \"2026-06-09 12:50\", \"pbm_vendor\": \"MLS\", \"qty_actual\": \"8201\", \"end_mooring\": \"2026-06-09 07:00\", \"spog_zona_2\": \"2026-06-08 21:16\", \"start_disch\": \"2026-06-14 07:00\", \"arrival_jetty\": \"2026-06-06 18:20\", \"back_to_jetty\": \"2026-06-15 18:50\", \"start_loading\": \"2026-06-08 15:00\", \"start_mooring\": \"2026-06-08 22:30\", \"floating_crane\": \"STV MAESTRO\", \"completed_disch\": \"2026-06-14 18:50\", \"mooring_place_1\": \"TAMBATAN JEMBAYAN\", \"mooring_place_2\": \"TAMBATAN PALARAN, PASSING P BUAYA\", \"ta_barges_actual\": \"2026-06-11 18:00\", \"completed_loading\": \"2026-06-08 21:25\", \"discharge_sequence\": \"5\", \"cargo_readiness_actual\": \"2026-06-11 07:00\", \"start_mooring_clear_pass\": \"2026-06-09 15:30\", \"cast_off_mooring_clear_pass\": \"2026-06-09 22:40\"}','','admin','2026-06-29 09:46:04',NULL),(74,47,'{\"rc\": \"0\", \"lhv\": \"2026-06-08 13:48\", \"pkk\": \"2026-06-09 14:43\", \"qty\": \"8,201\", \"rkbm\": \"2026-06-09 18:19\", \"ta_mv\": \"2026-06-10 12:00\", \"ta_flf\": \"2026-06-11 16:30\", \"sts_spb\": \"2026-06-08 15:15\", \"qty_disc\": \"8,201\", \"clear_pass\": \"2026-06-09 12:40\", \"pbm_vendor\": \"MLS\", \"qty_actual\": \"8201\", \"end_mooring\": \"2026-06-09 07:30\", \"spog_zona_2\": \"2026-06-08 17:00\", \"start_disch\": \"2026-06-12 23:05\", \"arrival_jetty\": \"2026-06-04 20:05\", \"back_to_jetty\": \"2026-06-14 15:10\", \"start_loading\": \"2026-06-07 16:00\", \"start_mooring\": \"2026-06-08 07:00\", \"floating_crane\": \"STV MAESTRO\", \"completed_disch\": \"2026-06-13 15:10\", \"mooring_place_1\": \"TAMBATAN JEMBAYAN\", \"mooring_place_2\": \"PASSING P BUAYA\", \"ta_barges_actual\": \"2026-06-11 10:00\", \"completed_loading\": \"2026-06-08 04:30\", \"discharge_sequence\": \"3\", \"cargo_readiness_actual\": \"2026-06-11 07:00\", \"start_mooring_clear_pass\": \"2026-06-09 15:50\"}','','admin','2026-06-29 09:46:04',NULL);
/*!40000 ALTER TABLE `coal_barge_operations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `coal_barge_rc_rows`
--

DROP TABLE IF EXISTS `coal_barge_rc_rows`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
  KEY `idx_coal_barge_rc_source_sibarges` (`source_sibarges_id`),
  KEY `idx_coal_barge_rc_created_at` (`created_at`),
  KEY `idx_coal_barge_rc_usage_status` (`usage_status`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `coal_barge_rc_rows`
--

LOCK TABLES `coal_barge_rc_rows` WRITE;
/*!40000 ALTER TABLE `coal_barge_rc_rows` DISABLE KEYS */;
INSERT INTO `coal_barge_rc_rows` VALUES (11,44,'used','{\"qty\": \"0\", \"buyer\": \"IP SURALAYA\", \"no_pk\": \"M.26-167\", \"qty_disc\": \"233\", \"pbm_vendor\": \"MLS\", \"qty_actual\": \"240\", \"start_disch\": \"2026-06-11 16:30\", \"mothervessel\": \"MV. JHONLIN 001\", \"arrival_jetty\": \"2026-05-25 13:00\", \"start_loading\": \"2026-05-25 15:50\", \"status_act_rc\": \"RC\", \"floating_crane\": \"STV MAESTRO\", \"completed_disch\": \"2026-06-12 08:00\", \"completed_loading\": \"2026-05-25 20:25\", \"status_act_act_rc\": \"ACT&RC\"}','','admin','2026-06-30 04:36:59','2026-06-30 04:37:21'),(12,44,'used','{\"qty\": \"0\", \"buyer\": \"IP SURALAYA\", \"no_pk\": \"M.26-167\", \"qty_disc\": \"233\", \"pbm_vendor\": \"MLS\", \"qty_actual\": \"240\", \"start_disch\": \"2026-06-11 16:30\", \"mothervessel\": \"MV. JHONLIN 001\", \"arrival_jetty\": \"2026-05-25 13:00\", \"start_loading\": \"2026-05-25 15:50\", \"status_act_rc\": \"RC\", \"floating_crane\": \"STV MAESTRO\", \"completed_disch\": \"2026-06-12 08:00\", \"completed_loading\": \"2026-05-25 20:25\", \"status_act_act_rc\": \"ACT&RC\"}','','admin','2026-07-01 08:23:41','2026-07-01 08:24:21');
/*!40000 ALTER TABLE `coal_barge_rc_rows` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping routines for database 'datacoalbarging'
--
--
-- WARNING: can't read the INFORMATION_SCHEMA.libraries table. It's most probably an old server 8.0.41.
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-07-17 11:47:43
