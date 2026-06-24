<?php
require_once __DIR__ . '/../../config.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Verify Admin Session via JWT token
    $current_user = check_admin_session('Admin');

    $name = $_POST['name'] ?? '';
    $award_type = $_POST['award_type'] ?? '';
    $mode = $_POST['mode'] ?? 'design';
    $html_content = $_POST['html_content'] ?? '';
    $css_content = $_POST['css_content'] ?? '';

    if (empty($name) || empty($award_type) || empty($html_content)) {
        echo json_encode(['success' => false, 'message' => 'Missing template name, award type, or content']);
        exit;
    }

    $is_custom_html = 1;
    $is_default = 0;

    // Dynamically ensure columns exist to prevent errors (safe standard syntax)
    $check_css = $conn->query("SHOW COLUMNS FROM certificate_templates LIKE 'css_content'");
    if ($check_css && $check_css->num_rows == 0) {
        $conn->query("ALTER TABLE certificate_templates ADD COLUMN css_content LONGTEXT NULL");
    }
    $check_mode = $conn->query("SHOW COLUMNS FROM certificate_templates LIKE 'mode'");
    if ($check_mode && $check_mode->num_rows == 0) {
        $conn->query("ALTER TABLE certificate_templates ADD COLUMN mode VARCHAR(50) DEFAULT 'design'");
    }

    $stmt = $conn->prepare("INSERT INTO certificate_templates (name, award_type, html_content, css_content, mode, is_custom_html, is_default) VALUES (?, ?, ?, ?, ?, ?, ?)");
    $stmt->bind_param("sssssii", $name, $award_type, $html_content, $css_content, $mode, $is_custom_html, $is_default);

    if ($stmt->execute()) {
        echo json_encode(['success' => true, 'message' => 'Template created successfully', 'id' => $stmt->insert_id]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Failed to create template: ' . $conn->error]);
    }

    $stmt->close();
} else {
    echo json_encode(['success' => false, 'message' => 'Invalid request method']);
}

$conn->close();
?>

