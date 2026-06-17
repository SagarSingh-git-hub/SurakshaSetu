<?php
require_once __DIR__ . '/../config.php';

header('Content-Type: application/json');

// Global Auth Middleware: Enforce Admin Session
$current_user = check_admin_session('Admin');

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    // Utilize index on status/login_time
    $res = $conn->query("SELECT id, user_id, ip_address, device, browser, location, login_time, last_activity, status FROM login_sessions ORDER BY login_time DESC");
    $sessions = [];
    if ($res) {
        while ($row = $res->fetch_assoc()) {
            $sessions[] = $row;
        }
    }
    echo json_encode(['success' => true, 'sessions' => $sessions]);
    exit();
    
} elseif ($method === 'POST') {
    // Check Rate Limiting for post requests
    check_rate_limit('manage_sessions', 30, 60);

    $action = $_POST['action'] ?? '';
    
    if ($action === 'logout') {
        $stmt = $conn->prepare("UPDATE login_sessions SET status = 'Terminated', last_activity = NOW() WHERE token = ?");
        $stmt->bind_param('s', $current_user['token']);
        $stmt->execute();
        $stmt->close();
        log_audit_action($current_user['email'], 'Admin Logout', 'Token: ' . $current_user['token']);
        echo json_encode(['success' => true, 'message' => 'Logged out successfully.']);
        exit();
    }

    // Enforce Super Admin permissions for modifications of other sessions
    if ($current_user['role'] !== 'Super Admin') {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'FORBIDDEN', 'message' => 'Super Admin privileges required to manage other sessions.']);
        exit();
    }

    $session_id = $_POST['session_id'] ?? '';
    $admin_user = $_POST['admin_user'] ?? $current_user['email'];
    
    if (empty($session_id) || empty($action)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Missing Session ID or Action.']);
        exit();
    }
    
    // Fetch before state
    $session_check = $conn->prepare("SELECT user_id, ip_address, token, status FROM login_sessions WHERE id = ?");
    $session_check->bind_param('i', $session_id);
    $session_check->execute();
    $before_state = $session_check->get_result()->fetch_assoc();
    $session_check->close();
    
    if (!$before_state) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Session not found.']);
        exit();
    }
    
    $target_user = $before_state['user_id'];
    $target_ip = $before_state['ip_address'];
    $status_val = '';
    
    if ($action === 'terminate') {
        $status_val = 'Terminated';
    } elseif ($action === 'force_logout') {
        $status_val = 'Force Logout';
    } elseif ($action === 'mark_safe') {
        $status_val = 'Safe';
    } else {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid action.']);
        exit();
    }
    
    $stmt = $conn->prepare("UPDATE login_sessions SET status = ?, last_activity = NOW() WHERE id = ?");
    $stmt->bind_param('si', $status_val, $session_id);
    
    if ($stmt->execute()) {
        $stmt->close();
        
        // Log to dedicated audit table
        log_audit_action($current_user['email'], 'Session Status Update', 'Session ID ' . $session_id, $before_state, ['status' => $status_val]);
        
        // Notify Pusher via private channel
        triggerPusherEvent('private-eco-channel', 'session-updated', [
            'session_id' => $session_id,
            'status' => $status_val,
            'user_id' => $target_user,
            'ip_address' => $target_ip
        ]);
        
        echo json_encode(['success' => true, 'message' => "Session status updated to $status_val successfully."]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Failed to update session: ' . $conn->error]);
    }
    exit();
}
?>
