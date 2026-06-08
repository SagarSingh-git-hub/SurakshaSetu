<?php
require_once __DIR__ . '/../config.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $report_id = $_POST['report_id'] ?? '';
    $priority = $_POST['priority'] ?? '';
    $admin_password = $_POST['admin_password'] ?? '';

    // Verify Admin Password
    if ($admin_password !== ADMIN_PASSWORD) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Unauthorized: Invalid Admin Credentials']);
        exit;
    }

    if (empty($report_id) || empty($priority)) {
        echo json_encode(['success' => false, 'message' => 'Missing report_id or priority']);
        exit;
    }

    $stmt = $conn->prepare("UPDATE reports SET priority = ? WHERE report_id = ?");
    $stmt->bind_param("ss", $priority, $report_id);

    if ($stmt->execute()) {
        // Trigger Pusher WebSocket Event
        triggerPusherEvent('eco-channel', 'update-priority', [
            'id' => $report_id,
            'priority' => $priority
        ]);
        
        echo json_encode(['success' => true, 'message' => 'Priority updated successfully']);
    } else {
        echo json_encode(['success' => false, 'message' => 'Failed to update priority: ' . $conn->error]);
    }

    $stmt->close();
} else {
    echo json_encode(['success' => false, 'message' => 'Invalid request method']);
}

$conn->close();
?>
