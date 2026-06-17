<?php
// DB migration script
require_once __DIR__ . '/../config.php';

header('Content-Type: application/json');

$queries = [
    "CREATE TABLE IF NOT EXISTS alerts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        alert_type VARCHAR(50) NOT NULL,
        severity VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        status VARCHAR(50) DEFAULT 'Active',
        escalation_level VARCHAR(50) DEFAULT 'Super Admin Notified',
        source VARCHAR(100),
        metadata TEXT,
        action_required TINYINT(1) DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        resolved_at DATETIME NULL,
        resolved_by VARCHAR(100) NULL
    )",
    "CREATE TABLE IF NOT EXISTS blocked_ips (
        id INT AUTO_INCREMENT PRIMARY KEY,
        ip_address VARCHAR(45) UNIQUE NOT NULL,
        reason VARCHAR(255),
        blocked_by VARCHAR(100),
        blocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME NULL,
        status VARCHAR(20) DEFAULT 'Blocked'
    )",
    "CREATE TABLE IF NOT EXISTS login_sessions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(100) NOT NULL,
        ip_address VARCHAR(45) NOT NULL,
        token VARCHAR(64) UNIQUE NULL,
        device VARCHAR(100),
        browser VARCHAR(100),
        location VARCHAR(100),
        login_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_activity DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        status VARCHAR(50) DEFAULT 'Active'
    )",
    "CREATE TABLE IF NOT EXISTS system_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        service_name VARCHAR(100) NOT NULL,
        log_level VARCHAR(50) NOT NULL,
        message TEXT,
        stack_trace TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )",
    "CREATE TABLE IF NOT EXISTS sync_jobs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        report_id VARCHAR(20),
        status VARCHAR(50) DEFAULT 'Pending',
        retry_count INT DEFAULT 0,
        last_attempt DATETIME NULL,
        next_attempt DATETIME NULL
    )",
    "CREATE TABLE IF NOT EXISTS audit_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        actor VARCHAR(100) NOT NULL,
        action VARCHAR(100) NOT NULL,
        target VARCHAR(255) NOT NULL,
        ip_address VARCHAR(45) NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        before_state TEXT NULL,
        after_state TEXT NULL
    )"
];

$results = [];
foreach ($queries as $index => $sql) {
    if ($conn->query($sql)) {
        $results[] = "Table Query " . ($index + 1) . " executed successfully.";
    } else {
        $results[] = "Table Query " . ($index + 1) . " failed: " . $conn->error;
    }
}

// ── MIGRATION STEPS FOR EXISTING INSTANCES ──

// 1. Add columns to existing tables if they don't exist
$check_token = $conn->query("SHOW COLUMNS FROM login_sessions LIKE 'token'");
if ($check_token && $check_token->num_rows == 0) {
    if ($conn->query("ALTER TABLE login_sessions ADD COLUMN token VARCHAR(64) UNIQUE NULL AFTER ip_address")) {
        $results[] = "Column 'token' added to login_sessions.";
    } else {
        $results[] = "Failed to add column 'token' to login_sessions: " . $conn->error;
    }
}

$check_esc = $conn->query("SHOW COLUMNS FROM alerts LIKE 'escalation_level'");
if ($check_esc && $check_esc->num_rows == 0) {
    if ($conn->query("ALTER TABLE alerts ADD COLUMN escalation_level VARCHAR(50) DEFAULT 'Super Admin Notified' AFTER status")) {
        $results[] = "Column 'escalation_level' added to alerts.";
    } else {
        $results[] = "Failed to add column 'escalation_level' to alerts: " . $conn->error;
    }
}

// 2. Add indexes safely
$create_index_safe = function($table, $index_name, $definition) use ($conn, &$results) {
    $check = $conn->query("SHOW INDEX FROM `$table` WHERE Key_name = '$index_name'");
    if ($check && $check->num_rows == 0) {
        if ($conn->query("CREATE INDEX `$index_name` ON `$table` ($definition)")) {
            $results[] = "Index '$index_name' created on '$table'.";
        } else {
            $results[] = "Failed to create index '$index_name': " . $conn->error;
        }
    } else {
        $results[] = "Index '$index_name' on '$table' already exists.";
    }
};

$create_index_safe('alerts', 'idx_alerts_type_status', 'alert_type, status');
$create_index_safe('alerts', 'idx_alerts_created', 'created_at');
$create_index_safe('blocked_ips', 'idx_blocked_ips_status_expiry', 'status, expires_at');
$create_index_safe('login_sessions', 'idx_sessions_token', 'token');
$create_index_safe('login_sessions', 'idx_sessions_status_time', 'status, login_time');
$create_index_safe('system_logs', 'idx_logs_timestamp', 'timestamp');
$create_index_safe('system_logs', 'idx_logs_service_level', 'service_name, log_level');
$create_index_safe('sync_jobs', 'idx_sync_jobs_status', 'status');

// 3. Add foreign key to sync_jobs
// First, clean up orphan sync jobs where report_id doesn't exist in reports table
$conn->query("DELETE FROM sync_jobs WHERE report_id NOT IN (SELECT report_id FROM reports)");

// Verify fk constraint
$fk_check = $conn->query("
    SELECT * FROM information_schema.TABLE_CONSTRAINTS 
    WHERE CONSTRAINT_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'sync_jobs' 
    AND CONSTRAINT_NAME = 'fk_sync_jobs_reports'
");
if ($fk_check && $fk_check->num_rows == 0) {
    if ($conn->query("ALTER TABLE sync_jobs ADD CONSTRAINT fk_sync_jobs_reports FOREIGN KEY (report_id) REFERENCES reports(report_id) ON DELETE CASCADE")) {
        $results[] = "Foreign key fk_sync_jobs_reports added to sync_jobs.";
    } else {
        $results[] = "Failed to add foreign key to sync_jobs: " . $conn->error;
    }
} else {
    $results[] = "Foreign key fk_sync_jobs_reports already exists.";
}

// 4. Initial Dummy Data
$dummy_alerts_check = $conn->query("SELECT COUNT(*) as cnt FROM alerts");
$row = $dummy_alerts_check->fetch_assoc();
if ($row['cnt'] == 0) {
    $conn->query("INSERT INTO alerts (alert_type, severity, title, description, status, source, action_required) 
                  VALUES ('security', 'Critical', 'Security — 8 failed login attempts on admin account', 'Account Auto Locked', 'Active', '103.41.62.18', 1)");
    
    $conn->query("INSERT INTO alerts (alert_type, severity, title, description, status, source, action_required) 
                  VALUES ('system', 'High', 'System — Real-time report sync failed', 'Database connection timeout during routine sync. 43 reports queued locally and waiting to be pushed to main cluster.', 'Active', 'sync_service', 1)");
    
    $conn->query("INSERT INTO sync_jobs (report_id, status, retry_count) VALUES 
                  ('ECO-001', 'Failed', 2), 
                  ('ECO-002', 'Failed', 1)");

    $conn->query("INSERT INTO login_sessions (user_id, ip_address, device, browser, location, status) VALUES 
                  ('admin@surakshasetu.org', '103.41.62.18', 'Windows 11 PC', 'Chrome 124', 'Dehradun, India', 'Active'),
                  ('admin@surakshasetu.org', '192.168.1.50', 'MacBook Pro', 'Safari 17', 'Nainital, India', 'Active')");

    $results[] = "Dummy data populated.";
}

echo json_encode(['success' => true, 'results' => $results]);
?>
