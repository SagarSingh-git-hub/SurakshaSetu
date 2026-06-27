<?php
require_once __DIR__ . '/../config.php';

// Global Auth Middleware: Enforce Super Admin Session for accessing logs
$current_user = check_admin_session('Super Admin');

// Check if we are doing a CSV export
$export = isset($_GET['export']) && $_GET['export'] === 'true';

if (!$export) {
    header('Content-Type: application/json');
}

// Check Rate Limiting for log requests
check_rate_limit('view_system_logs', 30, 60);

$time_range = $_GET['time_range'] ?? 'all';
$alert_id = $_GET['alert_id'] ?? null;

// Build SQL query utilizing indexes
$sql = "SELECT * FROM system_logs WHERE 1=1";
$params = [];
$types = '';

if ($alert_id) {
    $stmt = $conn->prepare("SELECT source, title FROM alerts WHERE id = ?");
    $stmt->bind_param("i", $alert_id);
    $stmt->execute();
    $alert_res = $stmt->get_result();
    if ($alert_res && $alert = $alert_res->fetch_assoc()) {
        $source = $alert['source'] ?: $alert['title'];
        $sql .= " AND (service_name LIKE ? OR message LIKE ?)";
        $search_param = "%$source%";
        $params[] = $search_param;
        $params[] = $search_param;
        $types .= 'ss';
    }
    $stmt->close();
}

$search = $_GET['search'] ?? '';

if ($time_range === 'hour') {
    $sql .= " AND timestamp > NOW() - INTERVAL 1 HOUR";
} elseif ($time_range === 'day') {
    $sql .= " AND timestamp > NOW() - INTERVAL 24 HOUR";
} elseif ($time_range === 'week') {
    $sql .= " AND timestamp > NOW() - INTERVAL 7 DAY";
}

if (!empty($search)) {
    $sql .= " AND (service_name LIKE ? OR log_level LIKE ? OR message LIKE ?)";
    $search_param = "%$search%";
    $params[] = $search_param;
    $params[] = $search_param;
    $params[] = $search_param;
    $types .= 'sss';
}

$sql .= " ORDER BY timestamp DESC";

$stmt = $conn->prepare($sql);
if (!empty($params)) {
    $stmt->bind_param($types, ...$params);
}
$stmt->execute();
$res = $stmt->get_result();

$logs = [];
if ($res) {
    while ($row = $res->fetch_assoc()) {
        $logs[] = $row;
    }
}
$stmt->close();

if ($export) {
    // Log audit log for log export
    log_audit_action($current_user['email'], 'System Logs Export', 'Time range: ' . $time_range . ', Search: ' . $search);
    
    header('Content-Type: text/csv');
    header('Content-Disposition: attachment; filename="system_logs_' . date('Ymd_His') . '.csv"');
    header('Pragma: no-cache');
    header('Expires: 0');
    
    $output = fopen('php://output', 'w');
    fputcsv($output, ['ID', 'Service Name', 'Log Level', 'Message', 'Stack Trace', 'Timestamp']);
    foreach ($logs as $log) {
        fputcsv($output, [
            $log['id'],
            $log['service_name'],
            $log['log_level'],
            $log['message'],
            $log['stack_trace'] ?? '',
            $log['timestamp']
        ]);
    }
    fclose($output);
    exit();
} else {
    // Log audit log for log view
    log_audit_action($current_user['email'], 'System Logs Query', 'Time range: ' . $time_range . ', Search: ' . $search);
    
    echo json_encode(['success' => true, 'logs' => $logs]);
    exit();
}
?>
