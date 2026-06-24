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

    $id = (int)$id;

    // Start Transaction
    $conn->begin_transaction();

    try {
        // Clear default on all templates
        $conn->query("UPDATE certificate_templates SET is_default = 0");

        // Set default on chosen template
        $stmt = $conn->prepare("UPDATE certificate_templates SET is_default = 1 WHERE id = ?");
        $stmt->bind_param("i", $id);
        $stmt->execute();
        $stmt->close();

        $conn->commit();
        echo json_encode(['success' => true, 'message' => 'Default template updated successfully']);
    } catch (Exception $e) {
        $conn->rollback();
        echo json_encode(['success' => false, 'message' => 'Failed to set default template: ' . $e->getMessage()]);
    }
} else {
    echo json_encode(['success' => false, 'message' => 'Invalid request method']);
}

$conn->close();
?>

