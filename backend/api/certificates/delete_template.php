<?php
require_once __DIR__ . '/../../config.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Verify Admin Session via JWT token
    $current_user = check_admin_session('Admin');

    $id = $_POST['id'] ?? '';

    if (empty($id)) {
        echo json_encode(['success' => false, 'message' => 'Missing template ID']);
        exit;
    }

    $stmt = $conn->prepare("DELETE FROM certificate_templates WHERE id = ?");
    $stmt->bind_param("i", $id);

    if ($stmt->execute()) {
        echo json_encode(['success' => true, 'message' => 'Template deleted successfully']);
    } else {
        echo json_encode(['success' => false, 'message' => 'Failed to delete template: ' . $conn->error]);
    }

    $stmt->close();
} else {
    echo json_encode(['success' => false, 'message' => 'Invalid request method']);
}

$conn->close();
?>

