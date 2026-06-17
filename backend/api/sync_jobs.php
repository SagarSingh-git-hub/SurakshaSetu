<?php
require_once __DIR__ . '/../config.php';

header('Content-Type: application/json');

// Global Auth Middleware: Enforce Admin Session
$current_user = check_admin_session('Admin');

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $res = $conn->query("SELECT * FROM sync_jobs");
    $jobs = [];
    $failed_count = 0;
    $pending_count = 0;
    $success_count = 0;
    
    if ($res) {
        while ($row = $res->fetch_assoc()) {
            $jobs[] = $row;
            if ($row['status'] === 'Failed') $failed_count++;
            elseif ($row['status'] === 'Pending') $pending_count++;
            elseif ($row['status'] === 'Success') $success_count++;
        }
    }
    
    echo json_encode([
        'success' => true,
        'jobs' => $jobs,
        'failed_count' => $failed_count,
        'pending_count' => $pending_count,
        'success_count' => $success_count,
        'total_queue' => $failed_count + $pending_count
    ]);
    exit();
    
} elseif ($method === 'POST') {
    // Enforce Super Admin permissions for modifications
    if ($current_user['role'] !== 'Super Admin') {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'FORBIDDEN', 'message' => 'Super Admin privileges required to retry sync jobs.']);
        exit();
    }
    
    // Check Rate Limiting for post requests
    check_rate_limit('retry_sync_jobs', 10, 60);

    $action = $_POST['action'] ?? '';
    
    if ($action !== 'retry') {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid action.']);
        exit();
    }
    
    // Set all failed/processing jobs to 'Pending' so the worker can pick them up
    $conn->query("UPDATE sync_jobs SET status = 'Pending' WHERE status = 'Failed'");
    
    // Log retrying audit
    log_audit_action($current_user['email'], 'Sync Retry Triggered', 'All Failed Sync Jobs');
    
    // Determine the path of the background worker script
    $worker_path = __DIR__ . '/../cron/sync_worker.php';
    
    // Spawn background process based on OS
    if (stripos(PHP_OS, 'WIN') === 0) {
        // Windows background execution
        pclose(popen("start /B php " . escapeshellarg($worker_path) . " " . escapeshellarg($current_user['email']) . " > NUL 2>&1", "r"));
    } else {
        // Linux/macOS background execution
        exec("php " . escapeshellarg($worker_path) . " " . escapeshellarg($current_user['email']) . " > /dev/null 2>&1 &");
    }
    
    // Immediately respond with 202 Accepted
    http_response_code(202);
    echo json_encode([
        'success' => true,
        'message' => 'Sync retry initiated in background. You will receive progress notifications.'
    ]);
    exit();
}
?>
