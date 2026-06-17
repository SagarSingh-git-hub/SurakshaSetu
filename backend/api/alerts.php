<?php
require_once __DIR__ . '/../config.php';

header('Content-Type: application/json');

// Global Auth Middleware: Enforce Admin Session
$current_user = check_admin_session('Admin');

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    // ── AUTO-RESOLUTION ENGINE ──
    
    // 1. Security Alerts Auto-Resolution: No failed login attempts for 30 minutes
    $active_sec_alerts = $conn->query("SELECT id, source, description FROM alerts WHERE alert_type = 'security' AND status = 'Active'");
    if ($active_sec_alerts && $active_sec_alerts->num_rows > 0) {
        // OPTIMIZATION: Eliminate N+1 query by pulling all recent warning logs in one query
        $ip_counts = [];
        $logs_res = $conn->query("SELECT message FROM system_logs WHERE service_name = 'admin_login' AND log_level = 'WARNING' AND timestamp > NOW() - INTERVAL 30 MINUTE");
        if ($logs_res) {
            while ($row = $logs_res->fetch_assoc()) {
                if (preg_match('/\[IP:\s*([\d\.]+)\]/', $row['message'], $matches)) {
                    $ip = $matches[1];
                    $ip_counts[$ip] = ($ip_counts[$ip] ?? 0) + 1;
                }
            }
        }

        while ($alert = $active_sec_alerts->fetch_assoc()) {
            $alert_id = $alert['id'];
            $source_ip = $alert['source'];
            $recent_fails = $ip_counts[$source_ip] ?? 0;
            
            if ($recent_fails === 0) {
                // Auto-resolve since there is no suspicious activity in the last 30 minutes
                $res_msg = "Resolved automatically: No failed logins from IP $source_ip for 30 minutes.";
                
                // Get before state for audit log
                $before_state = ['id' => $alert_id, 'status' => 'Active', 'description' => $alert['description']];
                
                $up_stmt = $conn->prepare("UPDATE alerts SET status = 'Resolved', resolved_at = NOW(), resolved_by = 'System (Auto-Resolve)', description = CONCAT(description, ?) WHERE id = ?");
                $desc_append = " | Auto-resolved: No suspicious activity for 30 minutes.";
                $up_stmt->bind_param('si', $desc_append, $alert_id);
                $up_stmt->execute();
                $up_stmt->close();
                
                // Write Audit Log
                log_audit_action('System', 'Alert Auto-Resolved', 'Alert ID ' . $alert_id, $before_state, ['status' => 'Resolved', 'description' => $alert['description'] . $desc_append]);
                
                // Real-time update via private channel
                triggerPusherEvent('private-eco-channel', 'alert-updated', [
                    'id' => $alert_id,
                    'status' => 'Resolved',
                    'resolved_by' => 'System (Auto-Resolve)'
                ]);
            }
        }
    }
    
    // 2. System Alerts Auto-Resolution: Queue processed successfully (no failed sync jobs)
    $active_sys_alerts = $conn->query("SELECT id, description FROM alerts WHERE alert_type = 'system' AND status = 'Active'");
    if ($active_sys_alerts && $active_sys_alerts->num_rows > 0) {
        $failed_jobs_check = $conn->query("SELECT COUNT(*) as cnt FROM sync_jobs WHERE status = 'Failed'");
        $failed_count = $failed_jobs_check->fetch_assoc()['cnt'];
        
        if ($failed_count === 0) {
            while ($alert = $active_sys_alerts->fetch_assoc()) {
                $alert_id = $alert['id'];
                $before_state = ['id' => $alert_id, 'status' => 'Active', 'description' => $alert['description']];
                
                $up_stmt = $conn->prepare("UPDATE alerts SET status = 'Resolved', resolved_at = NOW(), resolved_by = 'System (Auto-Resolve)', description = CONCAT(description, ' | Auto-resolved: Queue processed successfully.') WHERE id = ?");
                $up_stmt->bind_param('i', $alert_id);
                $up_stmt->execute();
                $up_stmt->close();
                
                // Write Audit Log
                log_audit_action('System', 'Alert Auto-Resolved', 'Alert ID ' . $alert_id, $before_state, ['status' => 'Resolved']);
                
                triggerPusherEvent('private-eco-channel', 'alert-updated', [
                    'id' => $alert_id,
                    'status' => 'Resolved',
                    'resolved_by' => 'System (Auto-Resolve)'
                ]);
            }
        }
    }

    // Fetch alerts (utilizes idx_alerts_created index)
    $res = $conn->query("SELECT * FROM alerts ORDER BY created_at DESC");
    $alerts = [];
    if ($res) {
        while ($row = $res->fetch_assoc()) {
            $alerts[] = $row;
        }
    }
    
    echo json_encode(['success' => true, 'alerts' => $alerts]);
    exit();

} elseif ($method === 'POST') {
    // Enforce Super Admin permissions for modifications
    if ($current_user['role'] !== 'Super Admin') {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'FORBIDDEN', 'message' => 'Super Admin privileges required to update alerts.']);
        exit();
    }
    
    // Check Rate Limiting for post requests
    check_rate_limit('update_alert_status', 30, 60);

    $id = $_POST['id'] ?? '';
    $status = $_POST['status'] ?? '';
    $resolved_by = $_POST['resolved_by'] ?? $current_user['email'];
    
    if (empty($id) || empty($status)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Missing ID or Status.']);
        exit();
    }
    
    // Fetch before state for audit logging
    $chk_stmt = $conn->prepare("SELECT * FROM alerts WHERE id = ?");
    $chk_stmt->bind_param('i', $id);
    $chk_stmt->execute();
    $before_state = $chk_stmt->get_result()->fetch_assoc();
    $chk_stmt->close();
    
    if (!$before_state) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Alert not found.']);
        exit();
    }
    
    $resolved_at = ($status === 'Resolved') ? date('Y-m-d H:i:s') : null;
    
    $stmt = $conn->prepare("UPDATE alerts SET status = ?, resolved_at = ?, resolved_by = ?, updated_at = NOW() WHERE id = ?");
    $stmt->bind_param('sssi', $status, $resolved_at, $resolved_by, $id);
    
    if ($stmt->execute()) {
        $stmt->close();
        
        // Log to dedicated audit table
        log_audit_action($current_user['email'], 'Alert Status Update', 'Alert ID ' . $id, $before_state, ['status' => $status, 'resolved_by' => $resolved_by, 'resolved_at' => $resolved_at]);
        
        // Real-time notify via private channel
        triggerPusherEvent('private-eco-channel', 'alert-updated', [
            'id' => $id,
            'status' => $status,
            'resolved_by' => $resolved_by
        ]);
        
        echo json_encode(['success' => true, 'message' => 'Alert status updated successfully.']);
    } else {
        echo json_encode(['success' => false, 'message' => 'Failed to update alert: ' . $conn->error]);
    }
    exit();
}
?>
