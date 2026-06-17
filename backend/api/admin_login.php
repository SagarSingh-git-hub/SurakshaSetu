<?php
require_once __DIR__ . '/../config.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Phase 1: Rate Limiting
    check_rate_limit('admin_login', 10, 60);

    $email = $_POST['email'] ?? '';
    $password = $_POST['password'] ?? '';
    $client_ip = $_SERVER['REMOTE_ADDR'] ?? '';

    $valid_emails = ['admin@ngo.org', 'admin@surakshasetu.org'];

    // Helper to log failed attempts and trigger alerts
    $handle_failed_attempt = function() use ($conn, $email, $client_ip) {
        // 1. Log failed attempt in system_logs
        $log_msg = "Failed login attempt for email $email [IP: $client_ip]";
        $stmt = $conn->prepare("INSERT INTO system_logs (service_name, log_level, message) VALUES ('admin_login', 'WARNING', ?)");
        $stmt->bind_param('s', $log_msg);
        $stmt->execute();
        $stmt->close();

        // 2. Count failed attempts in last 10 minutes from this IP
        $count_stmt = $conn->prepare("SELECT COUNT(*) as cnt FROM system_logs WHERE service_name = 'admin_login' AND log_level = 'WARNING' AND message LIKE ? AND timestamp > NOW() - INTERVAL 10 MINUTE");
        $ip_pattern = "%[IP: $client_ip]%";
        $count_stmt->bind_param('s', $ip_pattern);
        $count_stmt->execute();
        $count_res = $count_stmt->get_result()->fetch_assoc();
        $failed_count = $count_res['cnt'];
        $count_stmt->close();

        // 3. Trigger alert if failed attempts > 5
        if ($failed_count > 5) {
            $severity = $failed_count >= 8 ? 'Critical' : 'High';
            $title = "Security — $failed_count failed login attempts on admin account";
            $status_str = $failed_count >= 8 ? "Account Auto Locked" : "Warning - Suspicious IP Activity";
            $description = "IP: $client_ip. Status: $status_str";
            
            // Check if active alert exists for this source
            $alert_check = $conn->prepare("SELECT id FROM alerts WHERE alert_type = 'security' AND source = ? AND status = 'Active' LIMIT 1");
            $alert_check->bind_param('s', $client_ip);
            $alert_check->execute();
            $alert_res = $alert_check->get_result();
            
            $alert_id = 0;
            if ($alert_res && $alert_res->num_rows > 0) {
                $alert_id = $alert_res->fetch_assoc()['id'];
                $update_stmt = $conn->prepare("UPDATE alerts SET severity = ?, title = ?, description = ?, updated_at = NOW() WHERE id = ?");
                $update_stmt->bind_param('sssi', $severity, $title, $description, $alert_id);
                $update_stmt->execute();
                $update_stmt->close();
            } else {
                $insert_stmt = $conn->prepare("INSERT INTO alerts (alert_type, severity, title, description, status, source, action_required) VALUES ('security', ?, ?, ?, 'Active', ?, 1)");
                $insert_stmt->bind_param('ssss', $severity, $title, $description, $client_ip);
                $insert_stmt->execute();
                $alert_id = $conn->insert_id;
                $insert_stmt->close();
            }
            $alert_check->close();

            // 4. Lock account & block IP if failed attempts >= 8
            if ($failed_count >= 8) {
                $blocked_reason = "Brute force attack suspected ($failed_count failed login attempts)";
                $expires_at = date('Y-m-d H:i:s', strtotime('+24 hours'));
                
                $block_stmt = $conn->prepare("INSERT INTO blocked_ips (ip_address, reason, blocked_by, expires_at, status) VALUES (?, ?, 'System', ?, 'Blocked') ON DUPLICATE KEY UPDATE reason = ?, expires_at = ?, status = 'Blocked'");
                $block_stmt->bind_param('sssss', $client_ip, $blocked_reason, $expires_at, $blocked_reason, $expires_at);
                $block_stmt->execute();
                $block_stmt->close();

                // Log audit action
                $audit_msg = "IP $client_ip auto-blocked for 24 hours. Reason: $blocked_reason. Alert ID: $alert_id";
                $audit_stmt = $conn->prepare("INSERT INTO system_logs (service_name, log_level, message) VALUES ('audit', 'INFO', ?)");
                $audit_stmt->bind_param('s', $audit_msg);
                $audit_stmt->execute();
                $audit_stmt->close();
            }

            // 5. Notify Super Admins via Pusher
            triggerPusherEvent('eco-channel', 'new-alert', [
                'id' => $alert_id,
                'alert_type' => 'security',
                'severity' => $severity,
                'title' => $title,
                'description' => $description,
                'source' => $client_ip,
                'status' => 'Active',
                'created_at' => date('Y-m-d H:i:s')
            ]);
        }
        
        // Log to dedicated audit table
        log_audit_action('System', 'Admin Login Failed', $email, null, ['ip' => $client_ip, 'failed_attempts_count' => $failed_count]);
    };

    // Check if the email is valid
    if (!in_array($email, $valid_emails)) {
        $handle_failed_attempt();
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Email address not found.']);
        exit;
    }

    // Check if the password is correct
    if ($password !== ADMIN_PASSWORD) {
        $handle_failed_attempt();
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Incorrect password.']);
        exit;
    }

    // Login successful: Generate session token and log session
    $token = bin2hex(random_bytes(32));
    $user_agent = $_SERVER['HTTP_USER_AGENT'] ?? '';
    $browser = "Chrome";
    $device = "Windows 11 PC";
    if (preg_match('/Firefox/i', $user_agent)) $browser = 'Firefox';
    elseif (preg_match('/Safari/i', $user_agent) && !preg_match('/Chrome/i', $user_agent)) $browser = 'Safari';
    elseif (preg_match('/Edge/i', $user_agent)) $browser = 'Edge';

    if (preg_match('/Mobile|Android|iPhone/i', $user_agent)) $device = 'Mobile Device';

    $sess_stmt = $conn->prepare("INSERT INTO login_sessions (user_id, ip_address, token, device, browser, location, status) VALUES (?, ?, ?, ?, ?, 'Dehradun, India', 'Active')");
    $sess_stmt->bind_param('sssss', $email, $client_ip, $token, $device, $browser);
    $sess_stmt->execute();
    $sess_stmt->close();

    // Log to dedicated audit table
    $role = ($email === 'admin@surakshasetu.org' ? 'Super Admin' : 'Admin');
    log_audit_action($email, 'Admin Login Success', $email, null, ['ip' => $client_ip, 'token' => $token, 'role' => $role]);

    echo json_encode([
        'success' => true, 
        'message' => 'Login successful',
        'token' => $token,
        'role' => $role,
        'email' => $email
    ]);
} else {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method Not Allowed']);
}
?>

