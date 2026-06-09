<?php
require_once __DIR__ . '/../../config.php';

header('Content-Type: application/json');

// Ensure system_settings table exists
$conn->query("CREATE TABLE IF NOT EXISTS system_settings (
    setting_key VARCHAR(100) PRIMARY KEY,
    setting_value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
)");

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $result = $conn->query("SELECT setting_key, setting_value FROM system_settings");
    $settings = [];
    if ($result) {
        while ($row = $result->fetch_assoc()) {
            $settings[$row['setting_key']] = $row['setting_value'];
        }
    }
    
    // Default values if not set
    if (!isset($settings['auto_select'])) $settings['auto_select'] = '1';
    if (!isset($settings['mod_issue'])) $settings['mod_issue'] = '0';
    
    echo json_encode(['success' => true, 'settings' => $settings]);
} else {
    echo json_encode(['success' => false, 'message' => 'Invalid request method']);
}
$conn->close();
?>
