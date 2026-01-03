<?php
$host = 'localhost'; // 一般保持不变
$db   = '';   // 数据库名称，建议同步修改sql文件中的默认数据库名称
$user = '';          // 需要修改数据库账号
$pass = '';        // 需要修改数据库密码
$charset = 'utf8mb4';

// 【新增】接收备份的邮箱，当back_up.php?test=1时强制发送到该邮箱，便于测试
$smtp_config = [
    'host' => 'ssl://smtp.qq.com',  // SMTP服务器 (QQ用 ssl://smtp.qq.com, 163用 ssl://smtp.163.com)
    'port' => 465,                  // 端口 (SSL通常是 465)
    'user' => '',      // 你的发件邮箱账号
    'pass' => '',     // ⚠️ 注意：这里填“授权码”，不是登录密码！
    'from' => '',      // 发件人邮箱 (通常同账号)
    'to'   => '' // 你的收件邮箱
];
?>
