-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1:3307
-- Generation Time: Jun 15, 2026 at 12:11 PM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.0.30

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `databasemlp`
--

-- --------------------------------------------------------

--
-- Table structure for table `usermlp`
--

CREATE TABLE `usermlp` (
  `username` varchar(50) NOT NULL,
  `password` varchar(100) NOT NULL,
  `jabatan` enum('Div. Head','Dept. Head','Sect. Head','SPV','Staff') NOT NULL DEFAULT 'Staff',
  `divisi` enum('IT','Operation','VM&FAT','Finance&Accounting') NOT NULL DEFAULT 'Operation',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `usermlp`
--

INSERT INTO `usermlp` (`username`, `password`, `jabatan`, `divisi`, `created_at`) VALUES
('admin', 'snpsjn', 'SPV', 'IT', '2025-12-15 07:22:40'),
('dhea', 'snpsjn', 'Staff', 'Operation', '2025-12-15 10:13:13'),
('farida', 'snpsjn', 'Sect. Head', 'Finance&Accounting', '2025-12-15 10:13:41'),
('gunawan', 'snpsjn', 'SPV', 'Operation', '2025-12-15 07:22:40'),
('inaya', 'snpsjn', 'Staff', 'VM&FAT', '2025-12-15 07:22:40'),
('indra', 'snpsjn', 'Sect. Head', 'Operation', '2025-12-15 10:13:30'),
('jantri', 'snpsjn', 'Sect. Head', 'Operation', '2025-12-15 10:19:25'),
('nataya', 'snpsjn', 'SPV', 'Operation', '2025-12-15 07:22:40'),
('novita', 'snpsjn', 'Dept. Head', 'Finance&Accounting', '2025-12-15 10:13:01'),
('roseni', 'snpsjn', 'Sect. Head', 'Finance&Accounting', '2025-12-15 10:13:51'),
('wilson', 'snpsjn', 'SPV', 'Operation', '2025-12-15 07:22:40'),
('yusron', 'snpsjn', 'Dept. Head', 'Operation', '2025-12-15 10:12:46');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `usermlp`
--
ALTER TABLE `usermlp`
  ADD PRIMARY KEY (`username`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
