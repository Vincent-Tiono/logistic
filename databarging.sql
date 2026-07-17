-- MySQL dump 10.13  Distrib 8.0.41, for macos15 (x86_64)
--
-- Host: 127.0.0.1    Database: databarging
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
-- Current Database: `databarging`
--

CREATE DATABASE /*!32312 IF NOT EXISTS*/ `databarging` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;

USE `databarging`;

--
-- Table structure for table `barge_operations`
--

DROP TABLE IF EXISTS `barge_operations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `barge_operations` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `sibarges_id` bigint unsigned NOT NULL,
  `arrival_jetty` datetime DEFAULT NULL,
  `commence_loading` datetime DEFAULT NULL,
  `completed_loading` datetime DEFAULT NULL,
  `departure_jetty` datetime DEFAULT NULL,
  `arrival_anchorage` datetime DEFAULT NULL,
  `mooring` datetime DEFAULT NULL,
  `commence_discharging` datetime DEFAULT NULL,
  `completed_discharging` datetime DEFAULT NULL,
  `clear_pass` datetime DEFAULT NULL,
  `qty_ds` decimal(12,2) DEFAULT NULL,
  `flf` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `operation_status` enum('DRAFT','IN_PROGRESS','COMPLETED') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'DRAFT',
  `operation_data` json DEFAULT NULL,
  `remarks` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `created_by` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_barge_operations_sibarges` (`sibarges_id`),
  KEY `idx_operation_status` (`operation_status`),
  KEY `idx_operation_flf` (`flf`),
  CONSTRAINT `fk_barge_operations_sibarges` FOREIGN KEY (`sibarges_id`) REFERENCES `sibarges` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=77 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `barge_operations`
--

LOCK TABLES `barge_operations` WRITE;
/*!40000 ALTER TABLE `barge_operations` DISABLE KEYS */;
INSERT INTO `barge_operations` VALUES (2,22,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'DRAFT','{\"rc\": \"0\", \"lhv\": \"2026-05-24 08:52\", \"pkk\": \"2026-05-25 19:15\", \"qty\": \"8,203\", \"rkbm\": \"2026-05-26 19:31\", \"ta_mv\": \"2026-05-28 15:00\", \"ta_flf\": \"2026-05-29 07:00\", \"sts_spb\": \"2026-05-26 21:29\", \"qty_disc\": \"8,203\", \"clear_pass\": \"2026-05-25 12:20\", \"pbm_vendor\": \"PSS\", \"qty_actual\": \"8203\", \"end_mooring\": \"2026-05-25 10:30\", \"spog_zona_2\": \"2026-05-24 21:28\", \"start_disch\": \"2026-05-29 05:40\", \"arrival_jetty\": \"2026-05-23 20:00\", \"back_to_jetty\": \"2026-05-30 16:50\", \"start_loading\": \"2026-05-23 21:35\", \"start_mooring\": \"2026-05-24 04:20\", \"floating_crane\": \"FC RATU DEWATA\", \"completed_disch\": \"2026-05-29 17:10\", \"mooring_place_1\": \"TAMBATAN JEMBAYAN, H BARU\", \"mooring_place_2\": \"TAMBATAN PALARAN, PASSING P BUAYA\", \"ta_barges_actual\": \"2026-05-27 11:00\", \"completed_loading\": \"2026-05-24 03:25\", \"discharge_sequence\": \"1\", \"cargo_readiness_actual\": \"2026-05-27 11:00\", \"start_mooring_clear_pass\": \"2026-05-25 14:00\", \"cast_off_mooring_clear_pass\": \"2026-05-26 07:30\"}','','admin','2026-06-18 08:58:18','2026-06-19 02:09:21'),(25,33,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'DRAFT','{\"rc\": \"0\", \"lhv\": \"2026-05-24 17:49\", \"pkk\": \"2026-05-25 19:15\", \"qty\": \"8,101\", \"rkbm\": \"2026-05-26 19:31\", \"ta_mv\": \"2026-05-28 15:00\", \"ta_flf\": \"2026-05-29 07:00\", \"sts_spb\": \"2026-05-30 16:35\", \"qty_disc\": \"8,101\", \"clear_pass\": \"2026-05-25 15:25\", \"pbm_vendor\": \"PSS\", \"qty_actual\": \"8101\", \"end_mooring\": \"2026-05-25 12:45\", \"spog_zona_2\": \"2026-05-24 23:15\", \"start_disch\": \"2026-05-30 04:45\", \"arrival_jetty\": \"2026-05-21 21:15\", \"back_to_jetty\": \"2026-05-31 17:35\", \"start_loading\": \"2026-05-24 04:05\", \"start_mooring\": \"2026-05-24 13:30\", \"floating_crane\": \"FC RATU DEWATA\", \"completed_disch\": \"2026-05-30 13:10\", \"mooring_place_1\": \"TAMBATAN COBRA\", \"mooring_place_2\": \"PASSING P BUAYA\", \"ta_barges_actual\": \"2026-05-27 01:30\", \"completed_loading\": \"2026-05-24 10:55\", \"discharge_sequence\": \"5\", \"cargo_readiness_actual\": \"2026-05-27 11:00\", \"start_mooring_clear_pass\": \"2026-05-25 18:10\"}','','admin','2026-06-18 10:04:05','2026-06-19 02:09:40'),(26,34,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'DRAFT','{\"rc\": \"1,001\", \"lhv\": \"2026-05-25 11:48\", \"pkk\": \"2026-05-25 19:15\", \"qty\": \"7,002\", \"rkbm\": \"2026-05-26 19:31\", \"ta_mv\": \"2026-05-28 15:00\", \"ta_flf\": \"2026-05-29 07:00\", \"sts_spb\": \"2026-05-30 16:54\", \"qty_disc\": \"7,002\", \"clear_pass\": \"2026-05-27 17:20\", \"pbm_vendor\": \"PSS\", \"qty_actual\": \"8003\", \"end_mooring\": \"2026-05-27 12:50\", \"spog_zona_2\": \"2026-05-25 20:12\", \"start_disch\": \"2026-05-31 08:15\", \"arrival_jetty\": \"2026-05-24 23:00\", \"back_to_jetty\": \"2026-06-01 19:00\", \"start_loading\": \"2026-05-25 03:40\", \"start_mooring\": \"2026-05-25 16:10\", \"floating_crane\": \"FC RATU DEWATA\", \"completed_disch\": \"2026-05-31 16:20\", \"mooring_place_1\": \"TAMBATAN LOA DURI\", \"mooring_place_2\": \"PASSING P BUAYA\", \"ta_barges_actual\": \"2026-05-29 07:00\", \"completed_loading\": \"2026-05-25 09:55\", \"discharge_sequence\": \"8\", \"cargo_readiness_actual\": \"2026-05-27 11:00\", \"start_mooring_clear_pass\": \"2026-05-27 19:15\"}','','admin','2026-06-18 10:04:05','2026-06-19 02:10:24'),(27,35,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'DRAFT','{\"rc\": \"0\", \"lhv\": \"2026-05-24 22:00\", \"pkk\": \"2026-05-25 19:15\", \"qty\": \"7,002\", \"rkbm\": \"2026-05-26 19:31\", \"ta_mv\": \"2026-05-28 15:00\", \"ta_flf\": \"2026-05-29 07:00\", \"sts_spb\": \"2026-05-31 07:15\", \"qty_disc\": \"7,002\", \"clear_pass\": \"2026-05-25 15:20\", \"pbm_vendor\": \"PSS\", \"qty_actual\": \"7002\", \"end_mooring\": \"2026-05-25 13:00\", \"spog_zona_2\": \"2026-05-25 07:20\", \"start_disch\": \"2026-05-30 23:40\", \"arrival_jetty\": \"2026-05-16 08:00\", \"back_to_jetty\": \"2026-06-01 07:05\", \"start_loading\": \"2026-05-24 13:00\", \"start_mooring\": \"2026-05-24 19:00\", \"floating_crane\": \"FC RATU DEWATA\", \"completed_disch\": \"2026-05-31 07:05\", \"mooring_place_1\": \"TAMBATAN COBRA\", \"mooring_place_2\": \"PASSING P BUAYA\", \"ta_barges_actual\": \"2026-05-27 04:30\", \"completed_loading\": \"2026-05-24 16:50\", \"discharge_sequence\": \"6\", \"cargo_readiness_actual\": \"2026-05-27 11:00\", \"start_mooring_clear_pass\": \"2026-05-25 18:00\"}','','admin','2026-06-18 10:04:05','2026-06-19 02:10:44'),(28,36,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'DRAFT','{\"rc\": \"0\", \"lhv\": \"2026-05-24 15:51\", \"pkk\": \"2026-05-25 19:15\", \"qty\": \"8,001\", \"rkbm\": \"2026-05-26 19:31\", \"ta_mv\": \"2026-05-28 15:00\", \"ta_flf\": \"2026-05-29 07:00\", \"sts_spb\": \"2026-05-29 02:10\", \"qty_disc\": \"8,001\", \"clear_pass\": \"2026-05-25 15:30\", \"pbm_vendor\": \"PSS\", \"qty_actual\": \"8001\", \"end_mooring\": \"2026-05-25 11:15\", \"spog_zona_2\": \"2026-05-25 08:45\", \"start_disch\": \"2026-05-29 05:40\", \"arrival_jetty\": \"2026-05-17 04:10\", \"back_to_jetty\": \"2026-05-30 17:00\", \"start_loading\": \"2026-05-23 02:20\", \"start_mooring\": \"2026-05-24 14:30\", \"floating_crane\": \"FC RATU DEWATA\", \"completed_disch\": \"2026-05-29 17:10\", \"mooring_place_1\": \"TAMBATAN COBRA\", \"mooring_place_2\": \"PASSING P BUAYA\", \"ta_barges_actual\": \"2026-05-27 02:40\", \"completed_loading\": \"2026-05-24 12:00\", \"discharge_sequence\": \"2\", \"cargo_readiness_actual\": \"2026-05-27 11:00\", \"start_mooring_clear_pass\": \"2026-05-25 17:45\"}','','admin','2026-06-18 10:04:05','2026-06-19 02:10:56'),(29,37,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'DRAFT','{\"rc\": \"0\", \"lhv\": \"2026-05-25 09:30\", \"pkk\": \"2026-05-25 19:15\", \"qty\": \"8,001\", \"rkbm\": \"2026-05-26 19:31\", \"ta_mv\": \"2026-05-28 15:00\", \"ta_flf\": \"2026-05-29 07:00\", \"sts_spb\": \"2026-05-30 16:35\", \"qty_disc\": \"8,001\", \"clear_pass\": \"2026-05-29 07:35\", \"pbm_vendor\": \"PSS\", \"qty_actual\": \"8001\", \"end_mooring\": \"2026-05-29 04:30\", \"spog_zona_2\": \"2026-05-25 09:45\", \"start_disch\": \"2026-05-31 17:50\", \"arrival_jetty\": \"2026-05-17 19:45\", \"back_to_jetty\": \"2026-06-02 18:00\", \"start_loading\": \"2026-05-24 13:35\", \"start_mooring\": \"2026-05-25 02:00\", \"floating_crane\": \"FC RATU DEWATA\", \"completed_disch\": \"2026-06-01 04:25\", \"mooring_place_1\": \"TAMBATAN JEMBAYAN\", \"mooring_place_2\": \"PASSING P BUAYA\", \"ta_barges_actual\": \"2026-05-30 18:30\", \"completed_loading\": \"2026-05-24 23:25\", \"discharge_sequence\": \"9\", \"cargo_readiness_actual\": \"2026-05-27 11:00\", \"start_mooring_clear_pass\": \"2026-05-29 09:50\"}','','admin','2026-06-18 10:04:05','2026-06-19 02:11:14'),(30,38,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'DRAFT','{\"rc\": \"0\", \"lhv\": \"2026-05-24 16:50\", \"pkk\": \"2026-05-25 19:15\", \"qty\": \"8,002\", \"rkbm\": \"2026-05-26 19:31\", \"ta_mv\": \"2026-05-28 15:00\", \"ta_flf\": \"2026-05-29 07:00\", \"sts_spb\": \"2026-05-30 16:35\", \"qty_disc\": \"8,002\", \"clear_pass\": \"2026-05-25 15:55\", \"pbm_vendor\": \"PSS\", \"qty_actual\": \"8002\", \"end_mooring\": \"2026-05-25 13:00\", \"spog_zona_2\": \"2026-05-25 07:20\", \"start_disch\": \"2026-05-29 18:50\", \"arrival_jetty\": \"2026-05-16 16:50\", \"back_to_jetty\": \"2026-05-31 17:10\", \"start_loading\": \"2026-05-23 21:35\", \"start_mooring\": \"2026-05-24 18:20\", \"floating_crane\": \"FC RATU DEWATA\", \"completed_disch\": \"2026-05-30 13:10\", \"mooring_place_1\": \"TAMBATAN JEMBAYAN\", \"mooring_place_2\": \"PASSING P BUAYA\", \"ta_barges_actual\": \"2026-05-27 10:00\", \"completed_loading\": \"2026-05-24 03:25\", \"discharge_sequence\": \"4\", \"cargo_readiness_actual\": \"2026-05-27 11:00\", \"start_mooring_clear_pass\": \"2026-05-25 18:50\"}','','admin','2026-06-18 10:04:05','2026-06-19 02:11:24'),(31,39,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'DRAFT','{\"rc\": \"0\", \"lhv\": \"2026-05-26 06:58\", \"pkk\": \"2026-05-25 19:15\", \"qty\": \"7,402\", \"rkbm\": \"2026-05-26 19:31\", \"ta_mv\": \"2026-05-28 15:00\", \"ta_flf\": \"2026-05-29 07:00\", \"sts_spb\": \"2026-05-30 16:35\", \"qty_disc\": \"7,402\", \"clear_pass\": \"2026-05-27 16:45\", \"pbm_vendor\": \"PSS\", \"qty_actual\": \"7402\", \"end_mooring\": \"2026-05-27 15:00\", \"spog_zona_2\": \"2026-05-26 16:00\", \"start_disch\": \"2026-05-31 17:50\", \"arrival_jetty\": \"2026-05-25 13:00\", \"back_to_jetty\": \"2026-06-02 18:00\", \"start_loading\": \"2026-05-25 15:50\", \"start_mooring\": \"2026-05-25 22:15\", \"floating_crane\": \"FC RATU DEWATA\", \"completed_disch\": \"2026-06-01 04:25\", \"mooring_place_1\": \"TAMBATAN COBRA\", \"mooring_place_2\": \"TAMBATAN P ATAS, PASING P BUAYA\", \"ta_barges_actual\": \"2026-05-29 08:00\", \"completed_loading\": \"2026-05-25 20:25\", \"discharge_sequence\": \"10\", \"cargo_readiness_actual\": \"2026-05-27 11:00\", \"start_mooring_clear_pass\": \"2026-05-27 19:00\", \"cast_off_mooring_clear_pass\": \"2026-05-28 01:00\"}','','admin','2026-06-18 10:04:05','2026-06-19 02:11:35'),(32,40,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'DRAFT','{\"rc\": \"0\", \"lhv\": \"2026-05-26 20:23\", \"pkk\": \"2026-05-25 19:15\", \"qty\": \"8,001\", \"rkbm\": \"2026-05-26 19:31\", \"ta_mv\": \"2026-05-28 15:00\", \"ta_flf\": \"2026-05-29 07:00\", \"sts_spb\": \"2026-05-30 16:20\", \"qty_disc\": \"8,001\", \"clear_pass\": \"2026-05-27 18:17\", \"pbm_vendor\": \"PSS\", \"qty_actual\": \"8001\", \"end_mooring\": \"2026-05-27 15:30\", \"spog_zona_2\": \"2026-05-27 09:10\", \"start_disch\": \"2026-05-29 18:50\", \"arrival_jetty\": \"2026-05-22 20:00\", \"back_to_jetty\": \"2026-05-31 17:00\", \"start_loading\": \"2026-05-26 13:30\", \"start_mooring\": \"2026-05-26 20:35\", \"floating_crane\": \"FC RATU DEWATA\", \"completed_disch\": \"2026-05-30 03:55\", \"mooring_place_1\": \"TAMBATAN LOA DURI\", \"mooring_place_2\": \"PASSING P BUAYA\", \"ta_barges_actual\": \"2026-05-29 10:00\", \"completed_loading\": \"2026-05-26 18:25\", \"discharge_sequence\": \"3\", \"cargo_readiness_actual\": \"2026-05-27 11:00\", \"start_mooring_clear_pass\": \"2026-05-27 20:20\"}','','admin','2026-06-18 10:04:05','2026-06-19 02:11:48'),(33,41,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'DRAFT','{\"rc\": \"0\", \"lhv\": \"2026-05-26 10:54\", \"pkk\": \"2026-05-25 19:15\", \"qty\": \"8,002\", \"rkbm\": \"2026-05-26 19:31\", \"ta_mv\": \"2026-05-28 15:00\", \"ta_flf\": \"2026-05-29 07:00\", \"sts_spb\": \"2026-05-30 16:05\", \"qty_disc\": \"8,002\", \"clear_pass\": \"2026-05-28 15:40\", \"pbm_vendor\": \"PSS\", \"qty_actual\": \"8002\", \"end_mooring\": \"2026-05-28 15:10\", \"spog_zona_2\": \"2026-05-26 19:43\", \"start_disch\": \"2026-05-30 23:40\", \"arrival_jetty\": \"2026-05-18 17:40\", \"back_to_jetty\": \"2026-06-01 18:10\", \"start_loading\": \"2026-05-25 19:40\", \"start_mooring\": \"2026-05-26 10:20\", \"floating_crane\": \"FC RATU DEWATA\", \"completed_disch\": \"2026-05-31 16:20\", \"mooring_place_1\": \"TAMBATAN JEMBAYAN\", \"mooring_place_2\": \"PASSING P BUAYA\", \"ta_barges_actual\": \"2026-05-30 20:50\", \"completed_loading\": \"2026-05-26 09:40\", \"discharge_sequence\": \"7\", \"cargo_readiness_actual\": \"2026-05-27 11:00\", \"start_mooring_clear_pass\": \"2026-05-28 18:20\"}','','admin','2026-06-18 10:04:05','2026-06-19 02:12:00');
/*!40000 ALTER TABLE `barge_operations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `barges`
--

DROP TABLE IF EXISTS `barges`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `barges` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tugboat` varchar(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `barge` varchar(160) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `vendor` varchar(80) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `kontrak` varchar(80) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `muatan` decimal(12,2) DEFAULT NULL,
  `penalty` varchar(80) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tb` (`tugboat`),
  KEY `idx_bg` (`barge`)
) ENGINE=InnoDB AUTO_INCREMENT=115 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `barges`
--

LOCK TABLES `barges` WRITE;
/*!40000 ALTER TABLE `barges` DISABLE KEYS */;
INSERT INTO `barges` VALUES (1,'TB. MARINA 2201','BG. MARINE POWER 3037','BMC','DEDICATED',8200.00,'Deadfreight','2025-12-15 11:07:56',NULL),(2,'TB. MARINA 1605','BG. MARINE POWER 3033','BMC','DEDICATED',8200.00,'Deadfreight','2025-12-15 11:07:56',NULL),(3,'TB. MARINA 1611','BG. MARINE POWER 3047','BMC','DEDICATED',8200.00,'Deadfreight','2025-12-15 11:07:56',NULL),(4,'TB. MARINA 2201','BG. MARINE POWER 3037','BMC','DEDICATED',8200.00,'Deadfreight','2025-12-15 11:20:59',NULL),(5,'TB. MARINA 1605','BG. MARINE POWER 3033','BMC','DEDICATED',8200.00,'Deadfreight','2025-12-15 11:20:59',NULL),(6,'TB. MARINA 1611','BG. MARINE POWER 3047','BMC','DEDICATED',8200.00,'Deadfreight','2025-12-15 11:20:59',NULL),(7,'TB. BIAK 37','BG. GARUDA COAL XV','TMS','DEDICATED',9000.00,'Deadfreight','2025-12-15 11:20:59',NULL),(8,'TB. BIAK 39','BG. GARUDA COAL XVII','TMS','DEDICATED',9000.00,'Deadfreight','2025-12-15 11:20:59',NULL),(9,'TB. BIAK 36','BG. GARUDA COAL XII','TMS','DEDICATED',9000.00,'Deadfreight','2025-12-15 11:20:59',NULL),(10,'TB. BIAK 38','BG. GARUDA COAL XVI','TMS','DEDICATED',9000.00,'Deadfreight','2025-12-15 11:20:59',NULL),(11,'TB. AZALEA','BG. FITRIA 301','GLS','DEDICATED',7500.00,'Deadfreight','2025-12-15 11:20:59',NULL),(12,'TB. KSU 1','BG. KSU 171','KSU','DEDICATED',7500.00,'Deadfreight','2025-12-15 11:20:59',NULL),(13,'TB. BIAK 27','BG. GARUDA COAL II','KSU','DEDICATED',7500.00,'Deadfreight','2025-12-15 11:20:59',NULL),(14,'TB. KSU 3','BG. KSU 173','KSU','DEDICATED',7500.00,'Deadfreight','2025-12-15 11:20:59',NULL),(15,'TB. PRIMA STAR 16','BG. TAURUS 11','PPSJ','DEDICATED',7500.00,'Deadfreight','2025-12-15 11:20:59',NULL),(16,'TB. PRIMA MULIA 05','BG. PRIMA SEJATI 303','PPSJ','DEDICATED',7500.00,'Deadfreight','2025-12-15 11:20:59',NULL),(17,'TB. PRIMA STAR 37','BG. PRIMA SAKTI 53','PPSJ','DEDICATED',7500.00,'Deadfreight','2025-12-15 11:20:59',NULL),(18,'TB. PRIMA MAJU 01','BG. PMS STAR 302','PPSJ','DEDICATED',7500.00,'Deadfreight','2025-12-15 11:20:59',NULL),(19,'TB. PRIMA STAR 65','BG. KUNPHEN','PPSJ','DEDICATED',7500.00,'Deadfreight','2025-12-15 11:20:59',NULL),(20,'TB. PRIMA MULIA 02','BG. PRIMA SEJATI 309','PPSJ','DEDICATED',7500.00,'Deadfreight','2025-12-15 11:20:59',NULL),(21,'TB. LINTAS SAMUDERA 31','BG. WIRATIMUR 3017A','DLS','DEDICATED',7500.00,'Deadfreight','2025-12-15 11:20:59',NULL),(22,'TB. ARTHA KALTIM 16','BG. WIRATIMUR 3016A','DLS','DEDICATED',7500.00,'Deadfreight','2025-12-15 11:20:59',NULL),(23,'TB. AH 2018 01','BG. EHAL 2018 01','CNB','DEDICATED',7500.00,'Detention','2025-12-15 11:20:59',NULL),(24,'TB. AH 2018 02','BG. EHAL 2018 02','CNB','DEDICATED',7500.00,'Detention','2025-12-15 11:20:59',NULL),(25,'TB. INTAN MEGAH 26','BG. DEWI FATMAWATI','PSS','DEDICATED',7500.00,'Deadfreight','2025-12-15 11:20:59',NULL),(26,'TB. HERLINA 128','BG. DEWI FATMAWATI','PSS','DEDICATED',7500.00,'Deadfreight','2025-12-15 11:20:59',NULL),(27,'TB. INTAN MEGAH 17','BG. INTAN KELANA 22','PSS','DEDICATED',7500.00,'Deadfreight','2025-12-15 11:20:59',NULL),(28,'TB. SK 02','BG. SS 02','PSS','DEDICATED',7500.00,'Deadfreight','2025-12-15 11:20:59',NULL),(29,'TB. INTAN MEGAH 16','BG. INTAN KELANA 11','PSS','DEDICATED',7500.00,'Deadfreight','2025-12-15 11:20:59',NULL),(30,'TB. INTAN MEGAH 18','BG. INTAN KELANA 8','PSS','DEDICATED',7500.00,'Deadfreight','2025-12-15 11:20:59',NULL),(31,'TB. CPA 08','BG. SEA HORSE 07','PSS','DEDICATED',7500.00,'Deadfreight','2025-12-15 11:20:59',NULL),(32,'TB. INTAN MEGAH 16','BG. INTAN KELANA 8','PSS','DEDICATED',7500.00,'Deadfreight','2025-12-15 11:20:59',NULL),(33,'TB. INTAN MEGAH 2','BG. DEWI FATMAWATI','PSS','DEDICATED',7500.00,'Deadfreight','2025-12-15 11:20:59',NULL),(34,'TB. BIAK 35','BG. GARUDA COAL XI','TML','DEDICATED',8000.00,'Deadfreight','2025-12-15 11:20:59',NULL),(35,'TB. BIAK 10','BG. GARUDA COAL I','TML','DEDICATED',8500.00,'Deadfreight','2025-12-15 11:20:59',NULL),(36,'TB. BIAK 7','BG. GARUDA COAL VII','TML','DEDICATED',8000.00,'Deadfreight','2025-12-15 11:20:59',NULL),(37,'TB. BIAK 32','BG. GARUDA COAL IX','TML','DEDICATED',8000.00,'Deadfreight','2025-12-15 11:20:59',NULL),(38,'TB. BIAK 33','BG. GARUDA COAL X','TML','DEDICATED',8000.00,'Deadfreight','2025-12-15 11:20:59',NULL),(39,'TB. BIAK 12','BG. GARUDA COAL V','TML','DEDICATED',8000.00,'Deadfreight','2025-12-15 11:20:59',NULL),(40,'TB. BIAK 15','BG. GARUDA COAL VIII','TML','DEDICATED',8000.00,'Deadfreight','2025-12-15 11:20:59',NULL),(41,'TB. BIAK 25','BG. GARUDA COAL','TML','DEDICATED',8500.00,'Deadfreight','2025-12-15 11:20:59',NULL),(42,'TB. BIAK 11','BG. GARUDA COAL VI','TML','DEDICATED',8000.00,'Deadfreight','2025-12-15 11:20:59',NULL),(43,'TB. BIAK II','BG. GARUDA COAL III','TML','DEDICATED',8000.00,'Deadfreight','2025-12-15 11:20:59',NULL),(44,'TB. BIAK 32','BG. GARUDA COAL lX','TML','DEDICATED',8000.00,'Deadfreight','2025-12-15 11:20:59',NULL),(45,'TB. BIAK 7','BG. GARUDA COAL VIII','TML','DEDICATED',8000.00,'Deadfreight','2025-12-15 11:20:59',NULL),(46,'TB. KAILI I','BG. MOANA I','BDD','DEDICATED',7500.00,'Deadfreight','2025-12-15 11:20:59',NULL),(47,'TB. KAILI II','BG. MOANA II','BDD','DEDICATED',7500.00,'Deadfreight','2025-12-15 11:20:59',NULL),(48,'TB. MARINA 1618','BG. MARINE POWER 3073','BBS','DEDICATED',8900.00,'Deadfreight','2025-12-15 11:20:59',NULL),(49,'TB. MARINA 1618','BG. MARINE POWER 3049','BBS','DEDICATED',8200.00,'Deadfreight','2025-12-15 11:20:59',NULL),(50,'TB. MARINA 1623','BG. MARINE POWER 3053','BBS','DEDICATED',8200.00,'Deadfreight','2025-12-15 11:20:59',NULL),(51,'TB. MARINA 1630','BG. MARINE POWER 3085','BBS','DEDICATED',8200.00,'Deadfreight','2025-12-15 11:20:59',NULL),(52,'TB. MARINA 1631','BG. MARINE POWER 3073','BBS','DEDICATED',8900.00,'Deadfreight','2025-12-15 11:20:59',NULL),(53,'TB. MARINA 2247','BG. MARINE POWER 9001','BBS','DEDICATED',8900.00,'Deadfreight','2025-12-15 11:20:59',NULL),(54,'TB. MARINA 5','BG. MARINE POWER 3073','BBS','DEDICATED',8900.00,'Deadfreight','2025-12-15 11:20:59',NULL),(55,'TB. MARINA 5','BG. MARINE POWER 3085','BBS','DEDICATED',8200.00,'Deadfreight','2025-12-15 11:20:59',NULL),(56,'TB. MARINA 5','BG. MARINE POWER 3049','BBS','DEDICATED',8200.00,'Deadfreight','2025-12-15 11:20:59',NULL),(57,'TB. KSA 71','BG. BAIDURI 27269','KSA','SPOT',5000.00,'Detention','2025-12-15 11:20:59',NULL),(58,'TB. GMS CEMERLANG 1','BG. GMS 3201','GMS','DEDICATED',10000.00,'Deadfreight','2025-12-15 11:20:59',NULL),(59,'TB. GMS CEMERLANG 3','BG. GMS 3203','GMS','DEDICATED',10000.00,'Deadfreight','2025-12-15 11:20:59',NULL),(60,'TB. JAYA MANGALA 39','BG. SAMUDRA 3007','PPSJ','DEDICATED',7500.00,'Deadfreight','2025-12-15 11:20:59',NULL),(61,'TB. PRIMA STAR 27','BG. PRIMA SAKTI 52','PPSJ','DEDICATED',7500.00,'Deadfreight','2025-12-15 11:20:59',NULL),(62,'TB. PRIMA SURYA 01','BG. PES 3301','PPSJ','DEDICATED',10000.00,'Deadfreight','2025-12-15 11:20:59',NULL),(63,'TB. PRIME 9','BG. SUPPORT 6','PPSJ','DEDICATED',7500.00,'Deadfreight','2025-12-15 11:20:59',NULL),(64,'TB. ARTHA KALTIM 13','BG. PRIMA SAKTI 79','PPSJ','DEDICATED',7500.00,'Deadfreight','2025-12-15 11:20:59',NULL),(65,'TB. JAYA MANGGALA 39','BG. SAMUDRA 300-7','PPSJ','DEDICATED',7500.00,'Deadfreight','2025-12-15 11:20:59',NULL),(66,'TB. PRIMA MULIA 07','BG. PRIMA SEJATI 307','PPSJ','DEDICATED',7500.00,'Deadfreight','2025-12-15 11:20:59',NULL),(67,'TB. PRIMA STAR 6','BG. PRIMA SAKTI 76','PPSJ','DEDICATED',7500.00,'Deadfreight','2025-12-15 11:20:59',NULL),(68,'TB. PRIMA MULIA 05','BG. PRIMA SEJATI 303','PPSJ','DEDICATED',7500.00,'Deadfreight','2025-12-15 11:20:59','2025-12-16 09:35:14'),(69,'TB. ATLANTIC STAR 25','BG. TAURUS 15','PPSJ','DEDICATED',7500.00,'Deadfreight','2025-12-15 11:20:59',NULL),(70,'TB. CAHAYA RAJA ANUGRAH','BG. TAURUS 10','PPSJ','DEDICATED',7500.00,'Deadfreight','2025-12-15 11:20:59',NULL),(71,'TB. PRIMA STAR 16','BG. PRIMA SAKTI 27','PPSJ','DEDICATED',7500.00,'Deadfreight','2025-12-15 11:20:59',NULL),(72,'TB. ATLANTIC STAR 21','BG. PRIMA SEJATI 309','PPSJ','DEDICATED',7500.00,'Deadfreight','2025-12-15 11:20:59',NULL),(73,'TB. PRIMA STAR 25','BG. PRIMA SAKTI 27','PPSJ','DEDICATED',7500.00,'Deadfreight','2025-12-15 11:20:59',NULL),(74,'TB. DELTA AYU 388','BG. KALIMANTAN CAHAYA 88','AYU','DEDICATED',7500.00,'CQD','2025-12-15 11:20:59',NULL),(75,'TB. DELTA AYU 228','BG. KALIMANTAN CAHAYA','AYU','DEDICATED',7500.00,'CQD','2025-12-15 11:20:59',NULL),(76,'TB. DELTA AYU 188','BG. KALIMANTAN DELAPAN','AYU','DEDICATED',7500.00,'CQD','2025-12-15 11:20:59',NULL),(77,'TB. DELTA AYU 358','BG. KALIMANTAN ABADI 06','AYU','DEDICATED',7500.00,'CQD','2025-12-15 11:20:59',NULL),(78,'TB. DELTA AYU 618','BG. KALIMANTAN AYU 05','AYU','DEDICATED',10500.00,'CQD','2025-12-15 11:20:59',NULL),(79,'TB. DELTA AYU 8','BG. KALIMANTAN CAHAYA 38','AYU','DEDICATED',7500.00,'CQD','2025-12-15 11:20:59',NULL),(80,'TB. DELTA CAHAYA 2','BG. KALIMANTAN CAHAYA 58','AYU','DEDICATED',7500.00,'CQD','2025-12-15 11:20:59',NULL),(81,'TB. DELTA AYU 118','BG. KALIMANTAN DELAPAN','AYU','DEDICATED',7500.00,'CQD','2025-12-15 11:20:59',NULL),(82,'TB. DELTA CAHAYA 2','BG. KALIMANTAN CAHAYA 8','AYU','DEDICATED',7500.00,'CQD','2025-12-15 11:20:59',NULL),(83,'TB. DELTA AYU 28','BG. KALIMANTAN SATU','AYU','DEDICATED',7500.00,'CQD','2025-12-15 11:20:59',NULL),(84,'TB. DELTA AYU 1038','BG. KALIMANTAN AYU 08','AYU','DEDICATED',7500.00,'CQD','2025-12-15 11:20:59',NULL),(85,'TB. DELTA AYU 1028','BG. KALIMANTAN NUSANTARA 01','AYU','DEDICATED',7500.00,'CQD','2025-12-15 11:20:59',NULL),(86,'TB. DELTA AYU 338','BG. KALIMANTAN AYU 02','AYU','DEDICATED',7500.00,'CQD','2025-12-15 11:20:59',NULL),(87,'TB. DELTA AYU 658','BG. KALIMANTAN PERSADA 03','AYU','DEDICATED',7500.00,'CQD','2025-12-15 11:20:59',NULL),(88,'TB. DELTA ABADI 38','BG. KALIMANTAN ABADI 06','AYU','DEDICATED',7500.00,'CQD','2025-12-15 11:20:59',NULL),(89,'TB. VARUNA','BG. BROTHERHOOD I','DLS','DEDICATED',7500.00,'CQD','2025-12-15 11:20:59',NULL),(90,'TB. LINTAS SAMUDERA 102','BG. LINTAS SAMUDERA 106','DLS','DEDICATED',10000.00,'CQD','2025-12-15 11:20:59',NULL),(91,'TB. HARMONY VIII','BG. LINTAS SAMUDERA 106','DLS','DEDICATED',10000.00,'CQD','2025-12-15 11:20:59',NULL),(92,'TB. LINTAS SAMUDERA 116','BG. LINTAS SAMUDERA 106','DLS','DEDICATED',10000.00,'CQD','2025-12-15 11:20:59',NULL),(93,'TB. LINTAS SAMUDERA XXX','BG. LINTAS SAMUDERA 66','DLS','DEDICATED',10000.00,'CQD','2025-12-15 11:20:59',NULL),(94,'TB. LINTAS SAMUDERA 90','BG. LINTAS SAMUDERA 136','DLS','DEDICATED',7500.00,'CQD','2025-12-15 11:20:59',NULL),(95,'TB. HARMONY XII','BG. LINTAS SAMUDERA 119','DLS','DEDICATED',10000.00,'CQD','2025-12-15 11:20:59',NULL),(96,'TB. LINTAS SAMUDERA IX','BG. BROTHERHOOD II','DLS','DEDICATED',7500.00,'CQD','2025-12-15 11:20:59',NULL),(97,'TB. HARMONY I','?BG. LINTAS SAMUDERA 89','DLS','DEDICATED',7500.00,'CQD','2025-12-15 11:20:59',NULL),(98,'TB. HARMONY XXV','BG. LINTAS SAMUDERA VI','DLS','DEDICATED',7500.00,'CQD','2025-12-15 11:20:59','2025-12-16 09:35:10'),(99,'TB. LINTAS SAMUDERA XI','BG. LINTAS SAMUDERA 87','DLS','DEDICATED',7500.00,'CQD','2025-12-15 11:20:59',NULL),(100,'TB. HARMONY XXVI','BG. BAHARI JAYA 300','DLS','DEDICATED',7500.00,'CQD','2025-12-15 11:20:59',NULL),(101,'TB. DOLPHIN 58','BG. PATRA JAYA 2701','FAS','FAS',5000.00,'CQD','2025-12-15 11:20:59',NULL),(102,'TB. DELTA AYU 258','BG. KALIMANTAN 28','FAS','FAS',5000.00,'CQD','2025-12-15 11:20:59',NULL),(103,'TB. DELTA AYU 288','BG. KALIMANTAN 108','FAS','FAS',5000.00,'CQD','2025-12-15 11:20:59',NULL),(104,'TB. ZAHRA 01','BG. ADITAMA 301','FAS','FAS',8000.00,'CQD','2025-12-15 11:20:59',NULL),(105,'TB. DELTA CAHAYA 5','BG. KALIMANTAN CAHAYA 18','FAS','FAS',7500.00,'CQD','2025-12-15 11:20:59',NULL),(106,'TB. DELTA AYU 258','BG. KALIMANTAN 28','FAS','FAS',5000.00,'CQD','2025-12-15 11:20:59',NULL),(107,'TB. MITRA STAR VI','BG. MITRA IX','FAS','FAS',5000.00,'CQD','2025-12-15 11:20:59',NULL),(108,'TB. DELTA AYU 288','BG. KALIMANTAN 108','FAS','FAS',5000.00,'CQD','2025-12-15 11:20:59',NULL),(109,'TB. DELTA AYU 628','BG. KALIMANTAN PERSADA 01','FAS','FAS',7500.00,'CQD','2025-12-15 11:20:59',NULL),(110,'TB. HARMONY XXI','BG. LINTAS SAMUDERA 129','FAS','FAS',7500.00,'CQD','2025-12-15 11:20:59',NULL),(111,'TB. MAHAMERU 5','BG. MAHAMERU II','FAS','FAS',5000.00,'CQD','2025-12-15 11:20:59',NULL),(112,'TB. MAHAKARYA I','BG. SWISS BORNEO 1105','FAS','FAS',5000.00,'CQD','2025-12-15 11:20:59',NULL),(113,'TB. PERSADA XI','BG. KALTIM FT 50-01','FAS','FAS',5000.00,'CQD','2025-12-15 11:20:59','2025-12-15 11:33:06'),(114,'test','tes_b','BMC','DEDICATED',7000.00,'Deadfreight','2026-06-17 07:16:23',NULL);
/*!40000 ALTER TABLE `barges` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `flf`
--

DROP TABLE IF EXISTS `flf`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `flf` (
  `floating_crane` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `vendor_flf` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `pbm` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `anchorage` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`floating_crane`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `flf`
--

LOCK TABLES `flf` WRITE;
/*!40000 ALTER TABLE `flf` DISABLE KEYS */;
INSERT INTO `flf` VALUES ('FAS','FAS','FAS','FAS'),('FC ALI','PNTS','FLOATING CRANE','M.BERAU'),('FC APOLLO','PSSI','FLOATING CRANE','M.BERAU'),('FC BULK JAVA','PSS','FLOATING CRANE','M.BERAU'),('FC MARA','PSSI','FLOATING CRANE','M.BERAU'),('FC MUTIARA JAWA','MJ','FLOATING CRANE','M.BERAU'),('FC RATU DEWATA','PSS','FLOATING CRANE','M.BERAU'),('FC ZEUS','PSSI','FLOATING CRANE','M.BERAU'),('LONG TOWING','LONG TOWING','LONG TOWING','LONG TOWING'),('STV KTM','KTM','STEVEDORE','M.BERAU'),('STV MAESTRO','MLS','STEVEDORE','M.JAWA'),('WHS ISKANDAR','PNTS','FLOATING TERMINAL','M.BERAU');
/*!40000 ALTER TABLE `flf` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `jetty`
--

DROP TABLE IF EXISTS `jetty`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `jetty` (
  `jetty` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `nama_panjang` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`jetty`),
  UNIQUE KEY `uq_jetty_code` (`jetty`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `jetty`
--

LOCK TABLES `jetty` WRITE;
/*!40000 ALTER TABLE `jetty` DISABLE KEYS */;
INSERT INTO `jetty` VALUES ('ABK','JETTY PT ANUGERAH BARA KALTIM, EAST KALIMANTAN, INDONESIA'),('ABP2','JETTY PT ALAMJAYA BARA PRATAMA 02, EAST KALIMANTAN, INDONESIA'),('CAM','TERSUS GUNUNG BARA UTAMA, EAST KALIMANTAN, INDONESIA'),('CDI','TERSUS GUNUNG BARA UTAMA, EAST KALIMANTAN, INDONESIA'),('GBU','TERSUS GUNUNG BARA UTAMA, EAST KALIMANTAN, INDONESIA'),('IBP','JETTY PT RENCANA MULIA BARATAMA, BUKIT JERING, EAST KALIMANTAN'),('IM','JETTY PT ADIMITRA BARATAMA NUSANTARA, PENDINGIN, SANGA-SANGA, KALIMANTAN TIMUR, INDONESIA'),('IP','JETTY PT OORJA INDO KGS, EAST KALIMANTAN, INDONESIA'),('LKCT','JETTY LOA KULU COAL TERMINAL, EAST KALIMANTAN, INDONESIA'),('LOCT','JETTY LOA GAGAK COAL TERMINAL, EAST KALIMANTAN, INDONESIA'),('MTK','JETTY PT ALAMJAYA BARA PRATAMA 02, EAST KALIMANTAN, INDONESIA');
/*!40000 ALTER TABLE `jetty` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `shipper`
--

DROP TABLE IF EXISTS `shipper`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `shipper` (
  `shipper` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `pt` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `nama_lengkap` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`shipper`),
  UNIQUE KEY `uq_shipper_code` (`shipper`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `shipper`
--

LOCK TABLES `shipper` WRITE;
/*!40000 ALTER TABLE `shipper` DISABLE KEYS */;
INSERT INTO `shipper` VALUES ('CAM','PT. CEMERLANG ASA MANDIRI','PT CEMERLANG ASA MANDIRI\nJALAN TEBET BARAT RAYA NOMOR 22 B,\nTEBET BARAT, TEBET, KOTA ADM. JAKARTA SELATAN, DKI\nJAKARTA, INDONESIA'),('CDI','PT. CITRA DAYAK INDAH','PT CITRA DAYAK INDAH\nJL. RAPAK INDAH PERMAI\nBLOK F NO. 21 LOK BAHU, SUNGAI KUNJANG,\nSAMARINDA, KALIMANTAN TIMUR'),('MHU','PT. MULTI HARAPAN UTAMA','PT MULTI HARAPAN UTAMA\nCFX TOWER LANTAI 3-4, JALAN JENDERAL GATOT SUBROTO,\nKAVELING 35-36,\nKUNINGAN TIMUR, SETIABUDI, KOTA ADM. JAKARTA SELATAN,\nDKI JAKARTA, INDONESIA, 12950');
/*!40000 ALTER TABLE `shipper` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sibarges`
--

DROP TABLE IF EXISTS `sibarges`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sibarges` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `no_pk` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `no_si_vessel` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `buyer` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `mothervessel` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `si_type` enum('SJN','SNP') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `month_num` tinyint unsigned NOT NULL,
  `year_num` smallint unsigned NOT NULL,
  `barge_seq` int unsigned NOT NULL,
  `si_barges` varchar(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `tugboat` varchar(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `barge` varchar(160) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `term` enum('FOB','FAS','CIF') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `anchorage` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `qty_plan` decimal(12,2) NOT NULL DEFAULT '0.00',
  `laycan_start` date DEFAULT NULL,
  `laycan_end` date DEFAULT NULL,
  `jetty_code` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `jetty_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `shipper_code` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `shipper_name` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `record_status` enum('ACT','CANCEL','DISCARD') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACT',
  `remarks` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `created_by` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_si_barges` (`si_barges`),
  KEY `idx_no_pk` (`no_pk`),
  KEY `idx_no_pk_seq` (`no_pk`,`barge_seq`),
  KEY `idx_jetty` (`jetty_code`),
  KEY `idx_shipper` (`shipper_code`),
  KEY `idx_status` (`record_status`),
  KEY `idx_laycan` (`laycan_start`,`laycan_end`),
  CONSTRAINT `fk_sibarges_jetty` FOREIGN KEY (`jetty_code`) REFERENCES `jetty` (`jetty`) ON UPDATE CASCADE,
  CONSTRAINT `fk_sibarges_shipper` FOREIGN KEY (`shipper_code`) REFERENCES `shipper` (`shipper`) ON UPDATE CASCADE,
  CONSTRAINT `fk_sibarges_vessel` FOREIGN KEY (`no_pk`) REFERENCES `vessel` (`no_pk`) ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=42 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sibarges`
--

LOCK TABLES `sibarges` WRITE;
/*!40000 ALTER TABLE `sibarges` DISABLE KEYS */;
INSERT INTO `sibarges` VALUES (1,'M.25-283','176','MISEC','MV. SAKURA BREEZE','SJN',12,2025,1,'SI-SJN/XII/2025/176/1','TB. BIAK 36','BG. GARUDA COAL XII',NULL,NULL,9000.00,'2025-12-14','2025-12-15','ABP2','ABP2','MHU','PT MULTI HARAPAN UTAMA\nCFX TOWER LANTAI 3-4, JALAN JENDERAL GATOT SUBROTO,\nKAVELING 35-36,\nKUNINGAN TIMUR, SETIABUDI, KOTA ADM. JAKARTA SELATAN,\nDKI JAKARTA, INDONESIA, 12950','ACT','','admin','2025-12-17 05:31:35','2025-12-17 08:40:06'),(2,'M.25-283','176','MISEC','MV. SAKURA BREEZE','SJN',12,2025,2,'SI-SJN/XII/2025/176/2','TB. MARINA 2201','BG. MARINE POWER 3037',NULL,NULL,8200.00,'2025-12-14','2025-12-15','ABP2','ABP2','MHU','PT MULTI HARAPAN UTAMA\nCFX TOWER LANTAI 3-4, JALAN JENDERAL GATOT SUBROTO,\nKAVELING 35-36,\nKUNINGAN TIMUR, SETIABUDI, KOTA ADM. JAKARTA SELATAN,\nDKI JAKARTA, INDONESIA, 12950','ACT','','admin','2025-12-17 05:33:21','2025-12-17 08:40:00'),(3,'M.25-283','176','MISEC','MV. SAKURA BREEZE','SJN',12,2025,3,'SI-SJN/XII/2025/176/3','TB. BIAK 7','BG. GARUDA COAL VII',NULL,NULL,7380.00,'2025-12-15','2025-12-16','ABP2','JETTY PT ALAMJAYA BARA PRATAMA 02, EAST KALIMANTAN, INDONESIA','MHU','PT MULTI HARAPAN UTAMA\nCFX TOWER LANTAI 3-4, JALAN JENDERAL GATOT SUBROTO,\nKAVELING 35-36,\nKUNINGAN TIMUR, SETIABUDI, KOTA ADM. JAKARTA SELATAN,\nDKI JAKARTA, INDONESIA, 12950','ACT','','admin','2025-12-17 07:47:56',NULL),(4,'M.25-283','176','MISEC','MV. SAKURA BREEZE','SJN',12,2025,4,'SI-SJN/XII/2025/176/4','TB. KAILI I','BG. MOANA I',NULL,NULL,7500.00,'2025-12-15','2025-12-16','ABP2','ABP2','MHU','PT MULTI HARAPAN UTAMA\nCFX TOWER LANTAI 3-4, JALAN JENDERAL GATOT SUBROTO,\nKAVELING 35-36,\nKUNINGAN TIMUR, SETIABUDI, KOTA ADM. JAKARTA SELATAN,\nDKI JAKARTA, INDONESIA, 12950','ACT','','admin','2025-12-17 07:50:09','2025-12-17 08:40:12'),(5,'M.25-283','176','MISEC','MV. SAKURA BREEZE','SJN',12,2025,5,'SI-SJN/XII/2025/176/5','TB. BIAK 38','BG. GARUDA COAL XVI',NULL,NULL,9000.00,'2025-12-15','2025-12-16','MTK','JETTY PT ALAMJAYA BARA PRATAMA 02, EAST KALIMANTAN, INDONESIA','MHU','PT MULTI HARAPAN UTAMA\nCFX TOWER LANTAI 3-4, JALAN JENDERAL GATOT SUBROTO,\nKAVELING 35-36,\nKUNINGAN TIMUR, SETIABUDI, KOTA ADM. JAKARTA SELATAN,\nDKI JAKARTA, INDONESIA, 12950','ACT','','admin','2025-12-17 07:50:55','2025-12-17 08:40:20'),(6,'M.25-220','161','TNBF','MV. TAI CHANG','SJN',11,2025,1,'SI-SJN/XI/2025/161/1','TB. BIAK 10','BG. GARUDA COAL I',NULL,NULL,4700.00,'2025-11-05','2025-11-06','MTK','JETTY PT ALAMJAYA BARA PRATAMA 02, EAST KALIMANTAN, INDONESIA','MHU','PT MULTI HARAPAN UTAMA\nCFX TOWER LANTAI 3-4, JALAN JENDERAL GATOT SUBROTO,\nKAVELING 35-36,\nKUNINGAN TIMUR, SETIABUDI, KOTA ADM. JAKARTA SELATAN,\nDKI JAKARTA, INDONESIA, 12950','ACT','','admin','2025-12-17 08:48:35',NULL),(7,'M.25-220','161','TNBF','MV. TAI CHANG','SJN',11,2025,2,'SI-SJN/XI/2025/161/2','TB. BIAK 32','BG. GARUDA COAL IX',NULL,NULL,8000.00,'2025-11-06','2025-11-07','MTK','JETTY PT ALAMJAYA BARA PRATAMA 02, EAST KALIMANTAN, INDONESIA','MHU','PT MULTI HARAPAN UTAMA\nCFX TOWER LANTAI 3-4, JALAN JENDERAL GATOT SUBROTO,\nKAVELING 35-36,\nKUNINGAN TIMUR, SETIABUDI, KOTA ADM. JAKARTA SELATAN,\nDKI JAKARTA, INDONESIA, 12950','ACT','','admin','2025-12-17 08:48:35',NULL),(8,'M.25-220','161','TNBF','MV. TAI CHANG','SJN',11,2025,3,'SI-SJN/XI/2025/161/3','TB. BIAK 39','BG. GARUDA COAL XVII',NULL,NULL,9000.00,'2025-11-06','2025-11-07','MTK','JETTY PT ALAMJAYA BARA PRATAMA 02, EAST KALIMANTAN, INDONESIA','MHU','PT MULTI HARAPAN UTAMA\nCFX TOWER LANTAI 3-4, JALAN JENDERAL GATOT SUBROTO,\nKAVELING 35-36,\nKUNINGAN TIMUR, SETIABUDI, KOTA ADM. JAKARTA SELATAN,\nDKI JAKARTA, INDONESIA, 12950','ACT','','admin','2025-12-17 08:48:35',NULL),(9,'M.25-220','161','TNBF','MV. TAI CHANG','SJN',11,2025,4,'SI-SJN/XI/2025/161/4','TB. MARINA 2247','BG. MARINE POWER 9001',NULL,NULL,8900.00,'2025-11-06','2025-11-07','MTK','JETTY PT ALAMJAYA BARA PRATAMA 02, EAST KALIMANTAN, INDONESIA','MHU','PT MULTI HARAPAN UTAMA\nCFX TOWER LANTAI 3-4, JALAN JENDERAL GATOT SUBROTO,\nKAVELING 35-36,\nKUNINGAN TIMUR, SETIABUDI, KOTA ADM. JAKARTA SELATAN,\nDKI JAKARTA, INDONESIA, 12950','ACT','','admin','2025-12-17 08:48:35',NULL),(10,'M.25-220','161','TNBF','MV. TAI CHANG','SJN',11,2025,5,'SI-SJN/XI/2025/161/5','TB. BIAK 15','BG. GARUDA COAL VIII',NULL,NULL,8000.00,'2025-11-07','2025-11-08','MTK','JETTY PT ALAMJAYA BARA PRATAMA 02, EAST KALIMANTAN, INDONESIA','MHU','PT MULTI HARAPAN UTAMA\nCFX TOWER LANTAI 3-4, JALAN JENDERAL GATOT SUBROTO,\nKAVELING 35-36,\nKUNINGAN TIMUR, SETIABUDI, KOTA ADM. JAKARTA SELATAN,\nDKI JAKARTA, INDONESIA, 12950','ACT','','admin','2025-12-17 08:48:35',NULL),(11,'M.25-220','161','TNBF','MV. TAI CHANG','SJN',11,2025,6,'SI-SJN/XI/2025/161/6','TB. BIAK 38','BG. GARUDA COAL XVI',NULL,NULL,9000.00,'2025-11-07','2025-11-08','MTK','JETTY PT ALAMJAYA BARA PRATAMA 02, EAST KALIMANTAN, INDONESIA','MHU','PT MULTI HARAPAN UTAMA\nCFX TOWER LANTAI 3-4, JALAN JENDERAL GATOT SUBROTO,\nKAVELING 35-36,\nKUNINGAN TIMUR, SETIABUDI, KOTA ADM. JAKARTA SELATAN,\nDKI JAKARTA, INDONESIA, 12950','CANCEL','','admin','2025-12-17 08:48:35','2025-12-17 09:59:22'),(12,'M.25-220','161','TNBF','MV. TAI CHANG','SJN',11,2025,7,'SI-SJN/XI/2025/161/7','TB. MARINA 1618','BG. MARINE POWER 3049',NULL,NULL,8200.00,'2025-11-08','2025-11-09','MTK','JETTY PT ALAMJAYA BARA PRATAMA 02, EAST KALIMANTAN, INDONESIA','MHU','PT MULTI HARAPAN UTAMA\nCFX TOWER LANTAI 3-4, JALAN JENDERAL GATOT SUBROTO,\nKAVELING 35-36,\nKUNINGAN TIMUR, SETIABUDI, KOTA ADM. JAKARTA SELATAN,\nDKI JAKARTA, INDONESIA, 12950','ACT','','admin','2025-12-17 08:48:35',NULL),(13,'M.25-220','161','TNBF','MV. TAI CHANG','SJN',11,2025,8,'SI-SJN/XI/2025/161/8','TB. BIAK 35','BG. GARUDA COAL XI',NULL,NULL,7000.00,'2025-11-08','2025-11-09','MTK','JETTY PT ALAMJAYA BARA PRATAMA 02, EAST KALIMANTAN, INDONESIA','MHU','PT MULTI HARAPAN UTAMA\nCFX TOWER LANTAI 3-4, JALAN JENDERAL GATOT SUBROTO,\nKAVELING 35-36,\nKUNINGAN TIMUR, SETIABUDI, KOTA ADM. JAKARTA SELATAN,\nDKI JAKARTA, INDONESIA, 12950','ACT','','admin','2025-12-17 08:48:35',NULL),(14,'M.25-220','161','TNBF','MV. TAI CHANG','SJN',11,2025,9,'SI-SJN/XI/2025/161/9','TB. MARINA 1611','BG. MARINE POWER 3047',NULL,NULL,8200.00,'2025-11-09','2025-11-10','MTK','JETTY PT ALAMJAYA BARA PRATAMA 02, EAST KALIMANTAN, INDONESIA','MHU','PT MULTI HARAPAN UTAMA\nCFX TOWER LANTAI 3-4, JALAN JENDERAL GATOT SUBROTO,\nKAVELING 35-36,\nKUNINGAN TIMUR, SETIABUDI, KOTA ADM. JAKARTA SELATAN,\nDKI JAKARTA, INDONESIA, 12950','ACT','','admin','2025-12-17 08:48:35',NULL),(15,'M.25-220','161','TNBF','MV. TAI CHANG','SJN',11,2025,10,'SI-SJN/XI/2025/161/10','TB. INTAN MEGAH 2','BG. DEWI FATMAWATI',NULL,NULL,7500.00,'2025-11-06','2025-11-07','LOCT','JETTY LOA GAGAK COAL TERMINAL, EAST KALIMANTAN, INDONESIA','MHU','PT MULTI HARAPAN UTAMA\nCFX TOWER LANTAI 3-4, JALAN JENDERAL GATOT SUBROTO,\nKAVELING 35-36,\nKUNINGAN TIMUR, SETIABUDI, KOTA ADM. JAKARTA SELATAN,\nDKI JAKARTA, INDONESIA, 12950','ACT','','admin','2025-12-17 08:48:35',NULL),(16,'M.25-220','161','TNBF','MV. TAI CHANG','SJN',11,2025,11,'SI-SJN/XI/2025/161/11','TB. INTAN MEGAH 16','BG. INTAN KELANA 11',NULL,NULL,7500.00,'2025-11-06','2025-11-07','LKCT','JETTY LOA KULU COAL TERMINAL, EAST KALIMANTAN, INDONESIA','MHU','PT MULTI HARAPAN UTAMA\nCFX TOWER LANTAI 3-4, JALAN JENDERAL GATOT SUBROTO,\nKAVELING 35-36,\nKUNINGAN TIMUR, SETIABUDI, KOTA ADM. JAKARTA SELATAN,\nDKI JAKARTA, INDONESIA, 12950','ACT','','admin','2025-12-17 08:48:35',NULL),(17,'M.25-220','161','TNBF','MV. TAI CHANG','SJN',11,2025,12,'SI-SJN/XI/2025/161/12','TB. BIAK 33','BG. GARUDA COAL X',NULL,NULL,7000.00,'2025-11-08','2025-11-09','MTK','JETTY PT ALAMJAYA BARA PRATAMA 02, EAST KALIMANTAN, INDONESIA','MHU','PT MULTI HARAPAN UTAMA\nCFX TOWER LANTAI 3-4, JALAN JENDERAL GATOT SUBROTO,\nKAVELING 35-36,\nKUNINGAN TIMUR, SETIABUDI, KOTA ADM. JAKARTA SELATAN,\nDKI JAKARTA, INDONESIA, 12950','ACT','','admin','2025-12-17 08:48:35',NULL),(18,'M.25-220','161','TNBF','MV. TAI CHANG','SJN',11,2025,13,'SI-SJN/XI/2025/161/13','TB. BIAK II','BG. GARUDA COAL III',NULL,NULL,6990.00,'2025-11-09','2025-11-10','MTK','JETTY PT ALAMJAYA BARA PRATAMA 02, EAST KALIMANTAN, INDONESIA','MHU','PT MULTI HARAPAN UTAMA\nCFX TOWER LANTAI 3-4, JALAN JENDERAL GATOT SUBROTO,\nKAVELING 35-36,\nKUNINGAN TIMUR, SETIABUDI, KOTA ADM. JAKARTA SELATAN,\nDKI JAKARTA, INDONESIA, 12950','ACT','','admin','2025-12-17 08:48:35',NULL),(22,'M.26-006','069','TNBF','MV. MARINER K','SJN',5,2026,1,'SI-SJN/V/2026/069/1','TB. MARINA 1605','BG. MARINE POWER 3033','FOB','MUARA BERAU',8200.00,'2026-05-23','2026-05-24','MTK','JETTY PT ALAMJAYA BARA PRATAMA 02, EAST KALIMANTAN, INDONESIA','MHU','PT MULTI HARAPAN UTAMA\nCFX TOWER LANTAI 3-4, JALAN JENDERAL GATOT SUBROTO,\nKAVELING 35-36,\nKUNINGAN TIMUR, SETIABUDI, KOTA ADM. JAKARTA SELATAN,\nDKI JAKARTA, INDONESIA, 12950','ACT','','admin','2026-06-17 09:43:38','2026-06-18 05:08:21'),(33,'M.26-006','069','TNBF','MV. MARINER K','SJN',5,2026,3,'SI-SJN/V/2026/069/3','TB. KSU 5','BG. KSU 175','FOB','MUARA BERAU',8100.00,'2026-05-24','2026-05-25','MTK','JETTY PT ALAMJAYA BARA PRATAMA 02, EAST KALIMANTAN, INDONESIA','MHU','PT MULTI HARAPAN UTAMA\nCFX TOWER LANTAI 3-4, JALAN JENDERAL GATOT SUBROTO,\nKAVELING 35-36,\nKUNINGAN TIMUR, SETIABUDI, KOTA ADM. JAKARTA SELATAN,\nDKI JAKARTA, INDONESIA, 12950','ACT','','admin','2026-06-17 10:22:17','2026-06-18 05:08:21'),(34,'M.26-006','069','TNBF','MV. MARINER K','SJN',5,2026,4,'SI-SJN/V/2026/069/4','TB. KSU 3','BG. KSU 173','FOB','MUARA BERAU',8000.00,'2026-05-25','2026-05-26','MTK','JETTY PT ALAMJAYA BARA PRATAMA 02, EAST KALIMANTAN, INDONESIA','MHU','PT MULTI HARAPAN UTAMA\nCFX TOWER LANTAI 3-4, JALAN JENDERAL GATOT SUBROTO,\nKAVELING 35-36,\nKUNINGAN TIMUR, SETIABUDI, KOTA ADM. JAKARTA SELATAN,\nDKI JAKARTA, INDONESIA, 12950','ACT','','admin','2026-06-17 10:22:17','2026-06-18 05:08:21'),(35,'M.26-006','069','TNBF','MV. MARINER K','SJN',5,2026,5,'SI-SJN/V/2026/069/5','TB. BIAK 15','BG. GARUDA COAL','FOB','MUARA BERAU',7000.00,'2026-05-24','2026-05-25','MTK','JETTY PT ALAMJAYA BARA PRATAMA 02, EAST KALIMANTAN, INDONESIA','MHU','PT MULTI HARAPAN UTAMA\nCFX TOWER LANTAI 3-4, JALAN JENDERAL GATOT SUBROTO,\nKAVELING 35-36,\nKUNINGAN TIMUR, SETIABUDI, KOTA ADM. JAKARTA SELATAN,\nDKI JAKARTA, INDONESIA, 12950','ACT','','admin','2026-06-17 10:22:17','2026-06-18 05:08:21'),(36,'M.26-006','069','TNBF','MV. MARINER K','SJN',5,2026,6,'SI-SJN/V/2026/069/6','TB. BIAK 27','BG. GARUDA COAL II','FOB','MUARA BERAU',8000.00,'2026-05-24','2026-05-25','LKCT','JETTY LOA KULU COAL TERMINAL, EAST KALIMANTAN, INDONESIA','MHU','PT MULTI HARAPAN UTAMA\nCFX TOWER LANTAI 3-4, JALAN JENDERAL GATOT SUBROTO,\nKAVELING 35-36,\nKUNINGAN TIMUR, SETIABUDI, KOTA ADM. JAKARTA SELATAN,\nDKI JAKARTA, INDONESIA, 12950','ACT','','admin','2026-06-17 10:22:17','2026-06-18 05:08:21'),(37,'M.26-006','069','TNBF','MV. MARINER K','SJN',5,2026,7,'SI-SJN/V/2026/069/7','TB. BIAK 11','BG. GARUDA COAL VI','FOB','MUARA BERAU',8000.00,'2026-05-24','2026-05-25','LKCT','JETTY LOA KULU COAL TERMINAL, EAST KALIMANTAN, INDONESIA','MHU','PT MULTI HARAPAN UTAMA\nCFX TOWER LANTAI 3-4, JALAN JENDERAL GATOT SUBROTO,\nKAVELING 35-36,\nKUNINGAN TIMUR, SETIABUDI, KOTA ADM. JAKARTA SELATAN,\nDKI JAKARTA, INDONESIA, 12950','ACT','','admin','2026-06-17 10:22:17','2026-06-18 05:08:21'),(38,'M.26-006','069','TNBF','MV. MARINER K','SJN',5,2026,8,'SI-SJN/V/2026/069/8','TB. BIAK 7','BG. GARUDA COAL VII','FOB','MUARA BERAU',8000.00,'2026-05-24','2026-05-25','LOCT','JETTY LOA GAGAK COAL TERMINAL, EAST KALIMANTAN, INDONESIA','MHU','PT MULTI HARAPAN UTAMA\nCFX TOWER LANTAI 3-4, JALAN JENDERAL GATOT SUBROTO,\nKAVELING 35-36,\nKUNINGAN TIMUR, SETIABUDI, KOTA ADM. JAKARTA SELATAN,\nDKI JAKARTA, INDONESIA, 12950','ACT','','admin','2026-06-17 10:22:17','2026-06-18 05:08:21'),(39,'M.26-006','069','TNBF','MV. MARINER K','SJN',5,2026,9,'SI-SJN/V/2026/069/9','TB. KSU 1','BG. KSU 171','FOB','MUARA BERAU',7400.00,'2026-05-24','2026-05-25','MTK','JETTY PT ALAMJAYA BARA PRATAMA 02, EAST KALIMANTAN, INDONESIA','MHU','PT MULTI HARAPAN UTAMA\nCFX TOWER LANTAI 3-4, JALAN JENDERAL GATOT SUBROTO,\nKAVELING 35-36,\nKUNINGAN TIMUR, SETIABUDI, KOTA ADM. JAKARTA SELATAN,\nDKI JAKARTA, INDONESIA, 12950','ACT','','admin','2026-06-17 10:22:17','2026-06-18 05:08:21'),(40,'M.26-006','069','TNBF','MV. MARINER K','SJN',5,2026,10,'SI-SJN/V/2026/069/10','TB. BIAK 10','BG. GARUDA COAL I','FOB','MUARA BERAU',8000.00,'2026-05-25','2026-05-26','MTK','JETTY PT ALAMJAYA BARA PRATAMA 02, EAST KALIMANTAN, INDONESIA','MHU','PT MULTI HARAPAN UTAMA\nCFX TOWER LANTAI 3-4, JALAN JENDERAL GATOT SUBROTO,\nKAVELING 35-36,\nKUNINGAN TIMUR, SETIABUDI, KOTA ADM. JAKARTA SELATAN,\nDKI JAKARTA, INDONESIA, 12950','ACT','','admin','2026-06-17 10:22:17','2026-06-18 05:08:21'),(41,'M.26-006','069','TNBF','MV. MARINER K','SJN',5,2026,11,'SI-SJN/V/2026/069/11','TB. BIAK 12','BG. GARUDA COAL V','FOB','MUARA BERAU',8000.00,'2026-05-24','2026-05-25','LOCT','JETTY LOA GAGAK COAL TERMINAL, EAST KALIMANTAN, INDONESIA','MHU','PT MULTI HARAPAN UTAMA\nCFX TOWER LANTAI 3-4, JALAN JENDERAL GATOT SUBROTO,\nKAVELING 35-36,\nKUNINGAN TIMUR, SETIABUDI, KOTA ADM. JAKARTA SELATAN,\nDKI JAKARTA, INDONESIA, 12950','ACT','','admin','2026-06-17 10:22:17','2026-06-18 07:16:37');
/*!40000 ALTER TABLE `sibarges` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `vessel`
--

DROP TABLE IF EXISTS `vessel`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vessel` (
  `no_pk` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `no_si_vessel` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `buyer` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `mothervessel` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `anchorage` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `term` enum('FOB','FAS','CIF') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `laycan_start` date DEFAULT NULL,
  `laycan_end` date DEFAULT NULL,
  `ta_vessel` date DEFAULT NULL,
  `single_mt` decimal(15,2) DEFAULT '0.00',
  `blending_mt` decimal(15,2) DEFAULT '0.00',
  `stowageplan_mt` decimal(15,2) DEFAULT '0.00',
  `loading_rate_kontrak` decimal(15,2) DEFAULT '0.00',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`no_pk`),
  UNIQUE KEY `uq_vessel_no_pk` (`no_pk`),
  KEY `idx_buyer` (`buyer`),
  KEY `idx_vessel` (`mothervessel`),
  KEY `idx_laycan` (`laycan_start`,`laycan_end`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vessel`
--

LOCK TABLES `vessel` WRITE;
/*!40000 ALTER TABLE `vessel` DISABLE KEYS */;
INSERT INTO `vessel` VALUES ('C.25-055','063','BCPCL','MV. ROYAL IMAGE',NULL,NULL,'2025-11-20','2025-11-29','2025-11-26',55750.00,0.00,55750.00,0.00,'2025-12-15 11:04:02',NULL),('G.25-052','060','BCPCL','MV. KENZEN',NULL,NULL,'2025-11-05','2025-11-14','2025-11-07',60500.00,0.00,60500.00,0.00,'2025-12-15 10:21:54',NULL),('G.25-246','063','ABOITIZ','MV. MERCUR STAR',NULL,NULL,'2025-11-23','2025-12-02','2025-11-24',1780.00,75220.00,77000.00,0.00,'2025-12-15 11:04:02',NULL),('G.25-281','062','IRNC','MV. ANDHIKA ALISHA',NULL,NULL,'2025-11-13','2025-11-22','2025-11-15',74700.00,0.00,74700.00,0.00,'2025-12-15 11:04:02',NULL),('M.25-018','167','TANJUNG JATI B','MV. PRIMA ANDALAN I',NULL,NULL,'2025-11-26','2025-12-05','2025-11-16',0.00,67000.00,67000.00,0.00,'2025-12-15 11:04:02',NULL),('M.25-022','165','IP SURALAYA','MV. RAFA',NULL,NULL,'2025-11-17','2025-11-21','2025-11-13',50362.00,0.00,50362.00,0.00,'2025-12-15 11:04:02',NULL),('M.25-063','163','BCPCL','MV. SPINEL',NULL,NULL,'2025-11-11','2025-11-20','2025-11-15',60500.00,0.00,60500.00,0.00,'2025-12-15 11:04:02',NULL),('M.25-110','164','TNBF','MV. SFL YANGTZE',NULL,NULL,'2025-11-16','2025-11-25','2025-11-24',28130.00,50120.00,78250.00,0.00,'2025-12-15 11:04:02',NULL),('M.25-178','160','JAWA POWER','MV. MURSYID',NULL,NULL,'2025-11-05','2025-11-09','2025-11-04',55000.00,0.00,55000.00,0.00,'2025-12-15 10:21:54',NULL),('M.25-192','162','MISEC','MV. NOZOMI',NULL,NULL,'2025-11-08','2025-11-17','2025-11-08',20489.00,23011.00,43500.00,0.00,'2025-12-15 11:04:02',NULL),('M.25-220','161','TNBF','MV. TAI CHANG',NULL,NULL,'2025-11-06','2025-11-15','2025-11-08',43785.00,43615.00,87400.00,0.00,'2025-12-15 11:04:02',NULL),('M.25-283','176','MISEC','MV. SAKURA BREEZE',NULL,NULL,'2025-12-18','2025-12-27','2025-12-18',0.00,0.00,41085.00,0.00,'2025-12-16 10:58:05',NULL),('M.26-006','069','TNBF','MV. MARINER K','MUARA BERAU','FOB','2026-05-23','2026-06-01','2026-05-27',0.00,78700.00,78700.00,0.00,'2026-06-17 09:42:24','2026-06-18 05:03:27');
/*!40000 ALTER TABLE `vessel` ENABLE KEYS */;
UNLOCK TABLES;

-- Vessel-level defaults for TLU Operation.
ALTER TABLE `vessel`
  ADD COLUMN `pkk` date DEFAULT NULL AFTER `ta_vessel`,
  ADD COLUMN `rkbm` date DEFAULT NULL AFTER `pkk`;

--
-- Dumping events for database 'databarging'
--

--
-- Dumping routines for database 'databarging'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-06-22 10:17:12
