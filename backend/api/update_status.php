<?php
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/log_activity.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $report_id = $_POST['report_id'] ?? '';
    $status = $_POST['status'] ?? '';
    $admin_password = $_POST['admin_password'] ?? '';

    // Verify Admin Password
    if ($admin_password !== ADMIN_PASSWORD) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Unauthorized: Invalid Admin Credentials']);
        exit;
    }

    if (empty($report_id) || empty($status)) {
        echo json_encode(['success' => false, 'message' => 'Missing report_id or status']);
        exit;
    }

    $resolved_at_val = ($status === 'Resolved') ? date('Y-m-d H:i:s') : null;
    $stmt = $conn->prepare("UPDATE reports SET status = ?, resolved_at = ? WHERE report_id = ?");
    $stmt->bind_param("sss", $status, $resolved_at_val, $report_id);

    if ($stmt->execute()) {
        // Fetch report info for activity log
        $stmt_sel = $conn->prepare("SELECT category, location_str FROM reports WHERE report_id = ?");
        $stmt_sel->bind_param("s", $report_id);
        $stmt_sel->execute();
        $res = $stmt_sel->get_result();
        $cat = 'General'; $loc = 'Unknown';
        if ($res && $res->num_rows > 0) {
            $row = $res->fetch_assoc();
            $cat = $row['category'];
            $loc = $row['location_str'];
        }
        $stmt_sel->close();

        // Trigger Pusher WebSocket Event
        triggerPusherEvent('eco-channel', 'update-status', [
            'id' => $report_id,
            'status' => $status
        ]);
        
        $action = ($status === 'Resolved') ? "Issue #$report_id marked Resolved" : "Issue #$report_id status updated to $status";
        logActivity($conn, 'Status Changed', $report_id, $action, $cat, $loc);

        echo json_encode(['success' => true, 'message' => 'Status updated successfully']);
    } else {
        echo json_encode(['success' => false, 'message' => 'Failed to update status: ' . $conn->error]);
    }

    $stmt->close();
} else {
    echo json_encode(['success' => false, 'message' => 'Invalid request method']);
}

$conn->close();
?>
