<?php
require_once __DIR__ . '/../config.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $report_id = $_POST['report_id'] ?? '';
    // Verify Admin Session via JWT token
    $current_user = check_admin_session('Admin');

    if (empty($report_id)) {
        echo json_encode(['success' => false, 'message' => 'Missing report_id']);
        exit;
    }

    // First get the photos to delete them from the file system if needed
    $stmt = $conn->prepare("SELECT photo_path FROM report_photos WHERE report_id = ?");
    $stmt->bind_param("s", $report_id);
    $stmt->execute();
    $result = $stmt->get_result();
    while ($row = $result->fetch_assoc()) {
        $file = __DIR__ . '/../' . $row['photo_path'];
        if (file_exists($file)) {
            unlink($file);
        }
    }
    $stmt->close();

    $stmt = $conn->prepare("DELETE FROM reports WHERE report_id = ?");
    $stmt->bind_param("s", $report_id);

    if ($stmt->execute()) {
        // Trigger Pusher WebSocket Event (optional, to update clients in real-time)
        triggerPusherEvent('eco-channel', 'delete-report', [
            'id' => $report_id
        ]);
        
        echo json_encode(['success' => true, 'message' => 'Report deleted successfully']);
    } else {
        echo json_encode(['success' => false, 'message' => 'Failed to delete report: ' . $conn->error]);
    }

    $stmt->close();
} else {
    echo json_encode(['success' => false, 'message' => 'Invalid request method']);
}

$conn->close();
?>