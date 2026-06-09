<?php
require_once __DIR__ . '/../../config.php';

header('Content-Type: application/json');

// Ensure system_settings table exists
$conn->query("CREATE TABLE IF NOT EXISTS system_settings (
    setting_key VARCHAR(100) PRIMARY KEY,
    setting_value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
)");

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $admin_password = $_POST['admin_password'] ?? '';

    // Verify Admin Password
    if ($admin_password !== ADMIN_PASSWORD) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Unauthorized: Invalid Admin Credentials']);
        exit;
    }

    $setting_key = $_POST['setting_key'] ?? '';
    $setting_value = $_POST['setting_value'] ?? '';

    if (empty($setting_key)) {
        echo json_encode(['success' => false, 'message' => 'Missing setting key']);
        exit;
    }

    // Insert or update setting
    $stmt = $conn->prepare("INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)");
    $stmt->bind_param("ss", $setting_key, $setting_value);

    if ($stmt->execute()) {
        echo json_encode(['success' => true, 'message' => 'Setting updated successfully']);
    } else {
        echo json_encode(['success' => false, 'message' => 'Failed to update setting: ' . $conn->error]);
    }

    $stmt->close();
} else {
    echo json_encode(['success' => false, 'message' => 'Invalid request method']);
}
$conn->close();
?>
