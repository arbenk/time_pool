-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- 主机： 127.0.0.1
-- 生成日期： 2025-12-27 12:10:34
-- 服务器版本： 10.4.32-MariaDB
-- PHP 版本： 8.0.30

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- 数据库： `timedatabase`
--

-- --------------------------------------------------------

--
-- 表的结构 `projects`
--

CREATE TABLE `projects` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `time_pool` int(11) DEFAULT 0 COMMENT '时间池总秒数',
  `used_time` int(11) DEFAULT 0 COMMENT '已用时间(不含正在进行的)',
  `is_running` tinyint(1) DEFAULT 0,
  `last_start_time` int(11) DEFAULT 0 COMMENT '最后一次点击开始的时间戳',
  `created_at` datetime DEFAULT current_timestamp(),
  `is_deleted` tinyint(1) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- 表的结构 `project_logs`
--

CREATE TABLE `project_logs` (
  `id` int(11) NOT NULL,
  `project_id` int(11) NOT NULL,
  `action_type` varchar(50) NOT NULL COMMENT 'create, start, stop, modify_used, modify_pool',
  `message` text DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `snapshot_used` int(11) DEFAULT NULL COMMENT '记录时的已用时间快照',
  `snapshot_pool` int(11) DEFAULT NULL COMMENT '记录时的时间池快照'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- 转储表的索引
--

--
-- 表的索引 `projects`
--
ALTER TABLE `projects`
  ADD PRIMARY KEY (`id`);

--
-- 表的索引 `project_logs`
--
ALTER TABLE `project_logs`
  ADD PRIMARY KEY (`id`);

--
-- 在导出的表使用AUTO_INCREMENT
--

--
-- 使用表AUTO_INCREMENT `projects`
--
ALTER TABLE `projects`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- 使用表AUTO_INCREMENT `project_logs`
--
ALTER TABLE `project_logs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=100;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;

-- 1. 增加排序字段，默认值为 9999 (让新项目默认排在后面，或者你可以设为0)
ALTER TABLE `projects` ADD COLUMN `sort_order` INT(11) DEFAULT 0;

-- 2. (可选) 初始化现有数据的排序，让它们按 ID 顺序排列
SET @rownum=0;
UPDATE projects SET sort_order = (@rownum:=@rownum+1) ORDER BY id DESC;