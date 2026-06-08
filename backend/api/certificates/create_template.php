<?php
require_once __DIR__ . '/../../config.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $admin_password = $_POST['admin_password'] ?? '';

    // Verify Admin Password
    if ($admin_password !== ADMIN_PASSWORD) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Unauthorized: Invalid Admin Credentials']);
        exit;
    }

    $name = $_POST['name'] ?? '';
    $award_type = $_POST['award_type'] ?? '';
    
    // For visual builder
    $bg_gradient = $_POST['bg_gradient'] ?? 'linear-gradient(135deg,rgba(251,191,36,0.08),rgba(34,197,94,0.06))';
    $primary_color = $_POST['primary_color'] ?? 'var(--gold)';
    $secondary_color = $_POST['secondary_color'] ?? 'var(--t3)';
    $icon_class = $_POST['icon_class'] ?? 'ti ti-award';

    // For HTML editor
    $is_custom_html = isset($_POST['is_custom_html']) && $_POST['is_custom_html'] === 'true' ? 1 : 0;
    $html_content = $_POST['html_content'] ?? null;

    if (empty($name) || empty($award_type)) {
        echo json_encode(['success' => false, 'message' => 'Missing template name or award type']);
        exit;
    }

    // Default templates can only be edited, not created via UI normally, but we allow new ones to be added as custom
    $is_default = 0;

    $stmt = $conn->prepare("INSERT INTO certificate_templates (name, award_type, bg_gradient, primary_color, secondary_color, icon_class, html_content, is_custom_html, is_default) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
    $stmt->bind_param("ssssssisi", $name, $award_type, $bg_gradient, $primary_color, $secondary_color, $icon_class, $html_content, $is_custom_html, $is_default);

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
