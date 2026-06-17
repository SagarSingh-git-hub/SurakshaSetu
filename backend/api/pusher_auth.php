<?php
require_once __DIR__ . '/../config.php';

header('Content-Type: application/json');

// Global Auth Middleware: Enforce Admin Session
$current_user = check_admin_session('Admin');

$socket_id = $_POST['socket_id'] ?? '';
$channel_name = $_POST['channel_name'] ?? '';

if (empty($socket_id) || empty($channel_name)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Missing socket_id or channel_name.']);
    exit();
}

// Security Check: Only allow subscription to private-eco-channel
if ($channel_name !== 'private-eco-channel') {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Unauthorized channel subscription.']);
    exit();
}

// Generate Pusher subscription signature
$string_to_sign = $socket_id . ":" . $channel_name;
$signature = hash_hmac('sha256', $string_to_sign, PUSHER_SECRET);
$auth_string = PUSHER_KEY . ":" . $signature;

// Log authorization event in audit log
log_audit_action($current_user['email'], 'WebSocket Authorized', $channel_name);

echo json_encode(['auth' => $auth_string]);
exit();
?>
