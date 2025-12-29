<?php
if (file_exists(__DIR__ . '/config_local.php')) {
    require_once __DIR__ . '/config_local.php';
} else {
    // 无本地配置时，仅提示，不中断程序（云端环境友好）
    exit('【提示】请复制 config_local.php.example 并重命名为 config_local.php，填写真实服务器账号密码！');
}
// 1. 设置时区
date_default_timezone_set('Asia/Shanghai');


$dsn = "mysql:host=$host;dbname=$db;charset=$charset";
$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
];

try {
    $pdo = new PDO($dsn, $user, $pass, $options);
} catch (\PDOException $e) {
    die(json_encode(['error' => 'Database connection failed']));
}

header('Content-Type: application/json');

$action = $_POST['action'] ?? '';

// --- 辅助函数：记录日志并保存快照 ---
// 修改了函数签名，自动查询当前项目状态作为快照
function addLog($pdo, $projectId, $type, $msg) {
    // 1. 先查当前项目的状态
    $stmt = $pdo->prepare("SELECT used_time, time_pool FROM projects WHERE id = ?");
    $stmt->execute([$projectId]);
    $project = $stmt->fetch();
    
    $snapUsed = $project ? $project['used_time'] : 0;
    $snapPool = $project ? $project['time_pool'] : 0;

    // 2. 插入日志
    $stmt = $pdo->prepare("INSERT INTO project_logs (project_id, action_type, message, snapshot_used, snapshot_pool) VALUES (?, ?, ?, ?, ?)");
    $stmt->execute([$projectId, $type, $msg, $snapUsed, $snapPool]);
}

switch ($action) {
    case 'get_projects':
        $isDeleted = isset($_POST['view']) && $_POST['view'] === 'recycle' ? 1 : 0;
        $stmt = $pdo->prepare("SELECT * FROM projects WHERE is_deleted = ? ORDER BY id DESC");
        $stmt->execute([$isDeleted]);
        $projects = $stmt->fetchAll();
        $now = time();
        foreach ($projects as &$p) { $p['server_now'] = $now; }
        echo json_encode($projects);
        break;

    case 'create_project':
        $name = $_POST['name'];
        $desc = $_POST['description'];
        $poolHours = (int)$_POST['pool_hours'];
        $poolMins = (int)$_POST['pool_mins'];
        $totalSeconds = ($poolHours * 3600) + ($poolMins * 60);

        $stmt = $pdo->prepare("INSERT INTO projects (name, description, time_pool) VALUES (?, ?, ?)");
        $stmt->execute([$name, $desc, $totalSeconds]);
        $id = $pdo->lastInsertId();
        
        // 注意：addLog 内部会自动查询刚才插入的数据作为快照
        addLog($pdo, $id, 'create', "创建项目，预估时间 {$poolHours}小时{$poolMins}分钟");
        echo json_encode(['status' => 'success']);
        break;

    case 'toggle_timer':
        $id = $_POST['id'];
        $type = $_POST['type']; 
        $now = time();

        if ($type === 'start') {
            $stmt = $pdo->prepare("UPDATE projects SET is_running = 1, last_start_time = ? WHERE id = ?");
            $stmt->execute([$now, $id]);
            addLog($pdo, $id, 'start', "开始计时");
        } else {
            $remark = $_POST['remark'] ?? '完成计时';
            $stmt = $pdo->prepare("SELECT last_start_time, used_time FROM projects WHERE id = ?");
            $stmt->execute([$id]);
            $row = $stmt->fetch();
            
            $startTime = $row['last_start_time'];
            $addedTime = $now - $startTime;
            $newUsed = $row['used_time'] + $addedTime;

            $update = $pdo->prepare("UPDATE projects SET is_running = 0, used_time = ? WHERE id = ?");
            $update->execute([$newUsed, $id]);

            $delLog = $pdo->prepare("DELETE FROM project_logs WHERE project_id = ? AND action_type = 'start' ORDER BY id DESC LIMIT 1");
            $delLog->execute([$id]);

            $logData = [
                'start' => date("Y-m-d H:i:s", $startTime),
                'end'   => date("Y-m-d H:i:s", $now),
                'duration' => gmdate("H:i:s", $addedTime),
                'remark' => $remark
            ];
            
            addLog($pdo, $id, 'stop', json_encode($logData));
        }
        echo json_encode(['status' => 'success']);
        break;

    case 'modify_time':
        $id = $_POST['id'];
        $target = $_POST['target'];
        $method = $_POST['method'];
        $h = (int)$_POST['hours'];
        $m = (int)$_POST['minutes'];
        $remark = $_POST['remark'];
        $seconds = ($h * 3600) + ($m * 60);
        
        if ($target === 'used') {
            $stmt = $pdo->prepare("SELECT used_time FROM projects WHERE id = ?");
            $stmt->execute([$id]);
            $curr = $stmt->fetch()['used_time'];
            $newVal = ($method === 'add') ? $curr + $seconds : max(0, $curr - $seconds);
            $pdo->prepare("UPDATE projects SET used_time = ? WHERE id = ?")->execute([$newVal, $id]);
            $actionMsg = ($method === 'add') ? "增加" : "减少";
            addLog($pdo, $id, 'modify_used', "修改已用: {$actionMsg} {$h}h {$m}m (备注: $remark)");
        } else {
            $stmt = $pdo->prepare("SELECT time_pool FROM projects WHERE id = ?");
            $stmt->execute([$id]);
            $curr = $stmt->fetch()['time_pool'];
            $newVal = ($method === 'add') ? $curr + $seconds : max(0, $curr - $seconds);
            $pdo->prepare("UPDATE projects SET time_pool = ? WHERE id = ?")->execute([$newVal, $id]);
            $actionMsg = ($method === 'add') ? "增加" : "减少";
            addLog($pdo, $id, 'modify_pool', "修改时间池: {$actionMsg} {$h}h {$m}m (备注: $remark)");
        }
        echo json_encode(['status' => 'success']);
        break;
        
    case 'edit_info':
        $id = $_POST['id'];
        $name = $_POST['name'];
        $desc = $_POST['description'];
        $stmt = $pdo->prepare("UPDATE projects SET name = ?, description = ? WHERE id = ?");
        $stmt->execute([$name, $desc, $id]);
        echo json_encode(['status' => 'success']);
        break;

    case 'recycle_project':
        $id = $_POST['id'];
        $stmt = $pdo->prepare("SELECT is_running, last_start_time, used_time FROM projects WHERE id = ?");
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        if ($row['is_running']) {
             $now = time();
             $added = $now - $row['last_start_time'];
             $newUsed = $row['used_time'] + $added;
             $pdo->prepare("UPDATE projects SET is_running = 0, used_time = ? WHERE id = ?")->execute([$newUsed, $id]);
        }
        $pdo->prepare("UPDATE projects SET is_deleted = 1 WHERE id = ?")->execute([$id]);
        addLog($pdo, $id, 'recycle', "移入回收站");
        echo json_encode(['status' => 'success']);
        break;

    case 'restore_project':
        $id = $_POST['id'];
        $pdo->prepare("UPDATE projects SET is_deleted = 0 WHERE id = ?")->execute([$id]);
        addLog($pdo, $id, 'restore', "从回收站还原");
        echo json_encode(['status' => 'success']);
        break;

    case 'clean_project':
        $id = $_POST['id'];
        $pdo->prepare("DELETE FROM projects WHERE id = ?")->execute([$id]);
        $pdo->prepare("DELETE FROM project_logs WHERE project_id = ?")->execute([$id]);
        echo json_encode(['status' => 'success']);
        break;

    case 'clean_all_recycle':
        $stmt = $pdo->query("SELECT id FROM projects WHERE is_deleted = 1");
        $ids = $stmt->fetchAll(PDO::FETCH_COLUMN);
        if (!empty($ids)) {
            $inQuery = implode(',', array_fill(0, count($ids), '?'));
            $pdo->prepare("DELETE FROM project_logs WHERE project_id IN ($inQuery)")->execute($ids);
            $pdo->prepare("DELETE FROM projects WHERE is_deleted = 1")->execute();
        }
        echo json_encode(['status' => 'success']);
        break;

    case 'get_logs':
        $id = $_POST['id'];
        $view = $_POST['view'] ?? 'active';
        if ($view === 'recycle') {
            $stmt = $pdo->prepare("SELECT * FROM project_logs WHERE project_id = ? ORDER BY created_at DESC");
        } else {
            $stmt = $pdo->prepare("SELECT * FROM project_logs WHERE project_id = ? AND action_type NOT IN ('recycle', 'restore') ORDER BY created_at DESC");
        }
        $stmt->execute([$id]);
        echo json_encode($stmt->fetchAll());
        break;
        
    case 'clear_logs':
        $id = $_POST['id'];
        $stmt = $pdo->prepare("DELETE FROM project_logs WHERE project_id = ?");
        $stmt->execute([$id]);
        echo json_encode(['status' => 'success']);
        break;

    // --- 新增：时光倒流 (还原到某条日志) ---
    case 'rollback_log':
        $logId = $_POST['log_id'];
        $projectId = $_POST['project_id'];

        // 1. 获取目标日志的快照数据
        $stmt = $pdo->prepare("SELECT snapshot_used, snapshot_pool FROM project_logs WHERE id = ? AND project_id = ?");
        $stmt->execute([$logId, $projectId]);
        $targetLog = $stmt->fetch();

        if (!$targetLog || is_null($targetLog['snapshot_used'])) {
            die(json_encode(['status' => 'error', 'msg' => '无法还原：此记录无快照数据（可能是旧数据）。']));
        }

        // 2. 还原项目状态 (强制停止计时)
        $update = $pdo->prepare("UPDATE projects SET used_time = ?, time_pool = ?, is_running = 0 WHERE id = ?");
        $update->execute([$targetLog['snapshot_used'], $targetLog['snapshot_pool'], $projectId]);

        // 3. 删除时间轴之后的记录 (ID > logId)
        // 注意：我们保留当前的这一条记录作为“现在”的状态
        $delete = $pdo->prepare("DELETE FROM project_logs WHERE project_id = ? AND id > ?");
        $delete->execute([$projectId, $logId]);

        echo json_encode(['status' => 'success']);
        break;
}
?>