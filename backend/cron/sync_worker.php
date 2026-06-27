<?php
// Set CLI execution options to prevent timeouts
set_time_limit(0);
ini_set('max_execution_time', '0');

// Make sure we are running in CLI
if (php_sapi_name() !== 'cli') {
    die("This script can only be run via CLI.\n");
}

require_once __DIR__ . '/../config.php';

// Accept admin email as CLI argument
$admin_user = $argv[1] ?? 'System (Asynchronous Worker)';

// Fetch pending sync jobs utilizing idx_sync_jobs_status index
$jobs_res = $conn->query("SELECT * FROM sync_jobs WHERE status = 'Pending'");
$jobs = [];
if ($jobs_res) {
    while ($row = $jobs_res->fetch_assoc()) {
        $jobs[] = $row;
    }
}

$total = count($jobs);
if ($total === 0) {
    // Broadcast sync completed so the frontend doesn't hang
    triggerPusherEvent('private-eco-channel', 'sync-completed', [
        'success_count' => 0,
        'failed_count' => 0,
        'total' => 0
    ]);
    exit();
}

$success_count = 0;
$failed_count = 0;

// Update status to 'Processing'
$conn->query("UPDATE sync_jobs SET status = 'Processing' WHERE status = 'Pending'");

// Process sync jobs sequentially
for ($i = 0; $i < $total; $i++) {
    $job = $jobs[$i];
    $job_id = $job['id'];
    
    // Simulate API processing delay (500ms per record)
    usleep(500000);
    
    // Simulating success
    $new_status = 'Success';
    $success_count++;
    
    $up_stmt = $conn->prepare("UPDATE sync_jobs SET status = ?, retry_count = retry_count + 1, last_attempt = NOW() WHERE id = ?");
    $up_stmt->bind_param('si', $new_status, $job_id);
    $up_stmt->execute();
    $up_stmt->close();
    
    // Broadcast progress over private channel
    triggerPusherEvent('private-eco-channel', 'sync-progress', [
        'job_id' => $job['report_id'],
        'success_count' => $success_count,
        'failed_count' => $failed_count,
        'total' => $total,
        'remaining' => $total - $success_count - $failed_count,
        'percent' => round(($success_count / $total) * 100)
    ]);
}

// Log completed audit
log_audit_action($admin_user, 'Sync Process Completed', "Processed $success_count sync jobs successfully.");

// Fetch before state of sync failure alerts to log in audit
$alerts_check = $conn->query("SELECT * FROM alerts WHERE alert_type = 'system' AND title LIKE '%sync failed%' AND status = 'Active'");
$before_alerts = [];
if ($alerts_check) {
    while ($a = $alerts_check->fetch_assoc()) {
        $before_alerts[] = $a;
    }
}

// Automatically resolve system alerts related to sync
$conn->query("UPDATE alerts SET status = 'Resolved', resolved_at = NOW(), resolved_by = 'System (Sync Worker)', description = CONCAT(description, ' | Resolved: Asynchronous retry sync completed.') WHERE alert_type = 'system' AND title LIKE '%sync failed%' AND status = 'Active'");

// Write audits for resolved alerts
foreach ($before_alerts as $b_alert) {
    log_audit_action('System (Sync Worker)', 'Alert Auto-Resolved', 'Alert ID ' . $b_alert['id'], $b_alert, ['status' => 'Resolved', 'resolved_by' => 'System (Sync Worker)']);
}

// Broadcast sync completed over private channel
triggerPusherEvent('private-eco-channel', 'sync-completed', [
    'success_count' => $success_count,
    'failed_count' => $failed_count,
    'total' => $total
]);
?>
