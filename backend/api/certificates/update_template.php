<?php
require_once __DIR__ . '/../../config.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Verify Admin Session via JWT token
    $current_user = check_admin_session('Admin');

    $id = $_POST['id'] ?? '';
    $name = $_POST['name'] ?? '';
    $award_type = $_POST['award_type'] ?? '';
    $mode = $_POST['mode'] ?? 'design';
    $html_content = $_POST['html_content'] ?? '';
    $css_content = $_POST['css_content'] ?? '';

    if (empty($id) || empty($name) || empty($award_type) || empty($html_content)) {
        echo json_encode(['success' => false, 'message' => 'Missing required fields']);
        exit;
    }

    $stmt = $conn->prepare("UPDATE certificate_templates SET name=?, award_type=?, html_content=?, css_content=?, mode=? WHERE id=?");
    $stmt->bind_param("sssssi", $name, $award_type, $html_content, $css_content, $mode, $id);

    if ($stmt->execute()) {
        echo json_encode(['success' => true, 'message' => 'Template updated successfully']);
    } else {
        echo json_encode(['success' => false, 'message' => 'Failed to update template: ' . $conn->error]);
    }

    $stmt->close();
} else {
    echo json_encode(['success' => false, 'message' => 'Invalid request method']);
}

$conn->close();
?>

