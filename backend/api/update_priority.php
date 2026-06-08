<?php
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/log_activity.php';

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
        // Fetch report info for activity log
        $res = $conn->query("SELECT category, location_str FROM reports WHERE report_id = '" . $conn->real_escape_string($report_id) . "'");
        $cat = 'General'; $loc = 'Unknown';
        if ($res && $res->num_rows > 0) {
            $row = $res->fetch_assoc();
            $cat = $row['category'];
            $loc = $row['location_str'];
        }

        // Trigger Pusher WebSocket Event
        triggerPusherEvent('eco-channel', 'update-priority', [
            'id' => $report_id,
            'priority' => $priority
        ]);
        
        $action = ($priority === 'High') ? "Issue #$report_id escalated to High Priority" : "Issue #$report_id priority changed to $priority";
        logActivity($conn, 'Priority Changed', $report_id, $action, $cat, $loc);

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
