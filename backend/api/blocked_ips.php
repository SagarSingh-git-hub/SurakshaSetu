<?php
require_once __DIR__ . '/../config.php';

header('Content-Type: application/json');

// Global Auth Middleware: Enforce Admin Session
$current_user = check_admin_session('Admin');

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $res = $conn->query("SELECT * FROM blocked_ips ORDER BY blocked_at DESC");
    $ips = [];
    if ($res) {
        while ($row = $res->fetch_assoc()) {
            $ips[] = $row;
        }
    }
    echo json_encode(['success' => true, 'blocked_ips' => $ips]);
    exit();
    
} elseif ($method === 'POST') {
    // Enforce Super Admin permissions for modifications
    if ($current_user['role'] !== 'Super Admin') {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'FORBIDDEN', 'message' => 'Super Admin privileges required to block or unblock IPs.']);
        exit();
    }
    
    // Check Rate Limiting for post requests
    check_rate_limit('blocked_ips_modify', 30, 60);

    $action = $_POST['action'] ?? '';
    $ip_address = $_POST['ip_address'] ?? '';
    $blocked_by = $_POST['blocked_by'] ?? $current_user['email'];
    $reason = $_POST['reason'] ?? 'Security Violation';
    $duration = $_POST['duration'] ?? 'Permanent';
    
    if (empty($ip_address)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Missing IP address.']);
        exit();
    }
    
    // Basic IP validation (protects against malformed input / XSS)
    if (!filter_var($ip_address, FILTER_VALIDATE_IP)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid IP address format.']);
        exit();
    }
    
    if ($action === 'block') {
        $expires_at = null;
        if ($duration === '1 Hour') {
            $expires_at = date('Y-m-d H:i:s', strtotime('+1 hour'));
        } elseif ($duration === '24 Hours') {
            $expires_at = date('Y-m-d H:i:s', strtotime('+24 hours'));
        } elseif ($duration === '7 Days') {
            $expires_at = date('Y-m-d H:i:s', strtotime('+7 days'));
        }
        
        // Fetch before state (if any)
        $chk_stmt = $conn->prepare("SELECT * FROM blocked_ips WHERE ip_address = ?");
        $chk_stmt->bind_param('s', $ip_address);
        $chk_stmt->execute();
        $before_state = $chk_stmt->get_result()->fetch_assoc();
        $chk_stmt->close();
        
        $stmt = $conn->prepare("INSERT INTO blocked_ips (ip_address, reason, blocked_by, expires_at, status) 
                                VALUES (?, ?, ?, ?, 'Blocked') 
                                ON DUPLICATE KEY UPDATE reason = ?, blocked_by = ?, expires_at = ?, status = 'Blocked'");
        $stmt->bind_param('sssssss', $ip_address, $reason, $blocked_by, $expires_at, $reason, $blocked_by, $expires_at);
        
        if ($stmt->execute()) {
            $stmt->close();
            
            // Log to dedicated audit table
            log_audit_action($current_user['email'], 'IP Blocked', $ip_address, $before_state, ['reason' => $reason, 'expires_at' => $expires_at, 'status' => 'Blocked']);
            
            // Notify private Pusher channel
            triggerPusherEvent('private-eco-channel', 'ip-blocked', [
                'ip_address' => $ip_address,
                'status' => 'Blocked',
                'expires_at' => $expires_at,
                'reason' => $reason
            ]);
            
            echo json_encode(['success' => true, 'message' => "IP $ip_address blocked successfully."]);
        } else {
            echo json_encode(['success' => false, 'message' => 'Failed to block IP: ' . $conn->error]);
        }
        exit();
        
    } elseif ($action === 'unblock') {
        // Fetch before state
        $chk_stmt = $conn->prepare("SELECT * FROM blocked_ips WHERE ip_address = ?");
        $chk_stmt->bind_param('s', $ip_address);
        $chk_stmt->execute();
        $before_state = $chk_stmt->get_result()->fetch_assoc();
        $chk_stmt->close();
        
        $stmt = $conn->prepare("UPDATE blocked_ips SET status = 'Unblocked', expires_at = NOW() WHERE ip_address = ?");
        $stmt->bind_param('s', $ip_address);
        
        if ($stmt->execute()) {
            $stmt->close();
            
            // Log to dedicated audit table
            log_audit_action($current_user['email'], 'IP Unblocked', $ip_address, $before_state, ['status' => 'Unblocked']);
            
            // Notify private Pusher channel
            triggerPusherEvent('private-eco-channel', 'ip-blocked', [
                'ip_address' => $ip_address,
                'status' => 'Unblocked'
            ]);
            
            echo json_encode(['success' => true, 'message' => "IP $ip_address unblocked successfully."]);
        } else {
            echo json_encode(['success' => false, 'message' => 'Failed to unblock IP: ' . $conn->error]);
        }
        exit();
    }
}
?>
