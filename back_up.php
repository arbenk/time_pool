<?php
/**
 * 纯PHP数据库备份插件 (修复版：解决了头部缺失导致的550错误)
 */

@set_time_limit(0); 
@ini_set('memory_limit', '512M');

// 引入配置
if (file_exists(__DIR__ . '/config_local.php')) {
    require_once __DIR__ . '/config_local.php';
} else {
    die(json_encode(['status'=>'error', 'msg'=>'缺少配置文件 config_local.php']));
}

$isTestMode = isset($_GET['test']);

if ($isTestMode) {
    header('Content-Type: text/html; charset=utf-8');
    echo "<h2>🛠️ 备份插件测试模式 (详细日志版)</h2>";
} else {
    header('Content-Type: application/json');
}

// ----------------------
// 1. 连接数据库
// ----------------------
try {
    $dsn = "mysql:host=$host;dbname=$db;charset=$charset";
    $pdo = new PDO($dsn, $user, $pass, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    if($isTestMode) echo "✅ 数据库连接成功<br>";
} catch (PDOException $e) {
    die($isTestMode ? "❌ 数据库连接失败: ".$e->getMessage() : json_encode(['status'=>'error', 'msg'=>'DB Error']));
}

// ----------------------
// 2. 检查备份逻辑
// ----------------------
try {
    $pdo->exec("CREATE TABLE IF NOT EXISTS `system_settings` (`key_name` varchar(50) PRIMARY KEY, `key_value` varchar(255))");
    
    $stmt = $pdo->prepare("SELECT key_value FROM system_settings WHERE key_name = 'last_backup'");
    $stmt->execute();
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    
    $lastBackupStr = $row ? $row['key_value'] : '2000-01-01 00:00:00';
    $lastBackupTime = strtotime($lastBackupStr);
    $now = time();
    $interval = 30 * 24 * 60 * 60; 
    
    $shouldBackup = $isTestMode || (($now - $lastBackupTime) > $interval);

    if (!$shouldBackup) {
        if(!$isTestMode) echo json_encode(['status'=>'success', 'triggered'=>false, 'last_backup'=>$lastBackupStr]);
        exit;
    }

    if($isTestMode) echo "⏳ 开始生成 SQL...<br>";

    // ----------------------
    // 3. 生成 SQL
    // ----------------------
    $sqlContent = dumpDatabasePure($pdo, $db);
    $fileName = 'backup_' . date('Ymd_His') . '.sql';
    $filePath = __DIR__ . '/' . $fileName;

    if (file_put_contents($filePath, $sqlContent) === false) {
        throw new Exception("无法写入文件，请检查目录权限");
    }
    
    if($isTestMode) echo "✅ SQL文件生成成功: $fileName (" . round(filesize($filePath)/1024, 2) . " KB)<br>";
    if($isTestMode) echo "📧 正在尝试连接 SMTP 服务器...<br><hr>";

    // ----------------------
    // 4. SMTP 发送邮件
    // ----------------------
    if (!isset($smtp_config)) {
        throw new Exception("config_local.php 中缺少 \$smtp_config 配置");
    }

    $mailer = new SimpleSmtp($smtp_config, $isTestMode); 
    $subject = "【自动备份】计时器项目 - " . date('Y-m-d');
    $body = "系统自动执行数据库备份。\n备份时间: " . date('Y-m-d H:i:s');
    
    $isSent = $mailer->send($smtp_config['to'], $subject, $body, $filePath);

    if ($isSent) {
        $newDate = date('Y-m-d H:i:s');
        if ($row) {
            $pdo->prepare("UPDATE system_settings SET key_value = ? WHERE key_name = 'last_backup'")->execute([$newDate]);
        } else {
            $pdo->prepare("INSERT INTO system_settings (key_name, key_value) VALUES ('last_backup', ?)")->execute([$newDate]);
        }
        @unlink($filePath);

        if ($isTestMode) {
            echo "<hr>✅ <span style='color:green;font-weight:bold'>邮件发送成功！</span><br>";
        } else {
            echo json_encode(['status'=>'success', 'triggered'=>true, 'last_backup'=>$newDate]);
        }
    } else {
        throw new Exception("邮件发送失败");
    }

} catch (Exception $e) {
    if (file_exists($filePath)) @unlink($filePath);
    if ($isTestMode) {
        echo "<hr>❌ <span style='color:red'>错误: " . $e->getMessage() . "</span>";
    } else {
        echo json_encode(['status'=>'error', 'msg'=>$e->getMessage()]);
    }
}

// ==========================================
// 辅助函数与类
// ==========================================

function dumpDatabasePure($pdo, $dbName) {
    $content = "-- Pure PHP Backup: $dbName\n-- Date: " . date('Y-m-d H:i:s') . "\nSET NAMES utf8mb4;\n\n";
    $tables = [];
    $stmt = $pdo->query("SHOW TABLES");
    while ($row = $stmt->fetch(PDO::FETCH_NUM)) { $tables[] = $row[0]; }

    foreach ($tables as $table) {
        $content .= "DROP TABLE IF EXISTS `$table`;\n";
        $row = $pdo->query("SHOW CREATE TABLE `$table`")->fetch(PDO::FETCH_NUM);
        $content .= $row[1] . ";\n\n";
        
        $stmtData = $pdo->query("SELECT * FROM `$table`");
        if ($stmtData->rowCount() > 0) {
            $content .= "INSERT INTO `$table` VALUES ";
            $rows = [];
            while ($row = $stmtData->fetch(PDO::FETCH_NUM)) {
                $vals = array_map(function($v) use ($pdo) {
                    return $v === null ? "NULL" : $pdo->quote($v);
                }, $row);
                $rows[] = "(" . implode(",", $vals) . ")";
            }
            $content .= implode(",\n", $rows) . ";\n\n";
        }
    }
    return $content;
}

class SimpleSmtp {
    private $host; private $port; private $user; private $pass;
    private $debug;

    public function __construct($config, $debug = false) {
        $this->host = $config['host'];
        $this->port = $config['port'];
        $this->user = $config['user'];
        $this->pass = $config['pass'];
        $this->debug = $debug;
    }
    
    public function send($to, $subject, $body, $filePath = null) {
        // 忽略 SSL 证书错误
        $context = stream_context_create([
            'ssl' => [
                'verify_peer' => false,
                'verify_peer_name' => false,
                'allow_self_signed' => true
            ]
        ]);

        if ($this->debug) echo "正在连接 {$this->host}:{$this->port}...<br>";

        $socket = stream_socket_client($this->host . ":" . $this->port, $errno, $errstr, 30, STREAM_CLIENT_CONNECT, $context);
        
        if (!$socket) {
            if ($this->debug) echo "连接失败: $errstr ($errno)<br>";
            return false;
        }

        $this->read($socket, "CONNECT");

        if (!$this->cmd($socket, "EHLO localhost")) return false;
        if (!$this->cmd($socket, "AUTH LOGIN")) return false;
        if (!$this->cmd($socket, base64_encode($this->user))) return false;
        if (!$this->cmd($socket, base64_encode($this->pass))) return false;

        if (!$this->cmd($socket, "MAIL FROM: <" . $this->user . ">")) return false;
        if (!$this->cmd($socket, "RCPT TO: <" . $to . ">")) return false;
        if (!$this->cmd($socket, "DATA")) return false;

        // --- 核心修复：构建正确的邮件头 ---
        $boundary = "----=_NextPart_" . md5(time());
        
        // 头部信息
        $headers  = "MIME-Version: 1.0\r\n";
        $headers .= "From: <" . $this->user . ">\r\n"; // 必须包含 From
        $headers .= "To: <" . $to . ">\r\n";
        $headers .= "Subject: =?UTF-8?B?" . base64_encode($subject) . "?=\r\n";
        $headers .= "Content-Type: multipart/mixed; boundary=\"$boundary\"\r\n";
        $headers .= "\r\n"; // 头部和正文之间必须有空行

        // 正文部分
        $msg = "--$boundary\r\n";
        $msg .= "Content-Type: text/plain; charset=\"UTF-8\"\r\n";
        $msg .= "Content-Transfer-Encoding: base64\r\n\r\n";
        $msg .= chunk_split(base64_encode($body)) . "\r\n";

        // 附件部分
        if ($filePath && file_exists($filePath)) {
            $fileName = basename($filePath);
            $fileData = file_get_contents($filePath);
            $msg .= "--$boundary\r\n";
            $msg .= "Content-Type: application/octet-stream; name=\"$fileName\"\r\n";
            $msg .= "Content-Transfer-Encoding: base64\r\n";
            $msg .= "Content-Disposition: attachment; filename=\"$fileName\"\r\n\r\n";
            $msg .= chunk_split(base64_encode($fileData)) . "\r\n";
        }
        $msg .= "--$boundary--\r\n";
        $msg .= ".\r\n"; // 结束符号

        // 发送全部内容 (Headers + Body)
        fputs($socket, $headers . $msg);
        
        $response = $this->read($socket, "SEND DATA");
        
        $this->cmd($socket, "QUIT");
        fclose($socket);
        
        return strpos($response, '250') !== false;
    }

    private function cmd($socket, $cmd) {
        fputs($socket, $cmd . "\r\n");
        $debugCmd = (strpos($cmd, "AUTH") !== false || strlen($cmd) > 50) ? substr($cmd, 0, 10)."..." : $cmd;
        if ($this->debug) echo "<span style='color:blue'>Client:</span> $debugCmd<br>";
        
        $res = $this->read($socket, $debugCmd);
        
        if (!preg_match('/^[23]/', $res)) {
            if ($this->debug) echo "<span style='color:red;font-weight:bold'>Stopping due to error.</span><br>";
            return false;
        }
        return true;
    }

    private function read($socket, $stage) {
        $response = '';
        while ($str = fgets($socket, 515)) {
            $response .= $str;
            if (substr($str, 3, 1) == ' ') break;
        }
        if ($this->debug) echo "<span style='color:orange'>Server ($stage):</span> $response<br>";
        return $response;
    }
}
?>