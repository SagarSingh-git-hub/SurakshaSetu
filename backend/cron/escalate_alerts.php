<?php
// CLI Alert Escalation Script
if (php_sapi_name() !== 'cli') {
    die("This script can only be run via CLI.\n");
}

require_once __DIR__ . '/../config.php';

// Fetch all active critical alerts utilizing index
$res = $conn->query("SELECT * FROM alerts WHERE severity = 'Critical' AND status = 'Active'");
if (!$res) {
    exit();
}

$escalations_processed = 0;

while ($alert = $res->fetch_assoc()) {
    $alert_id = $alert['id'];
    $created_time = strtotime($alert['created_at']);
    $now = time();
    $elapsed_mins = floor(($now - $created_time) / 60);
    
    $target_level = 'Super Admin Notified';
    if ($elapsed_mins >= 60) {
        $target_level = 'EMERGENCY UNRESOLVED';
    } elseif ($elapsed_mins >= 30) {
        $target_level = 'Escalated to Platform Owner';
    } elseif ($elapsed_mins >= 15) {
        $target_level = 'Escalated to Security Team';
    }
    
    if ($alert['escalation_level'] !== $target_level) {
        $before_state = ['escalation_level' => $alert['escalation_level']];
        $after_state = ['escalation_level' => $target_level];
        
        $up_stmt = $conn->prepare("UPDATE alerts SET escalation_level = ?, updated_at = NOW() WHERE id = ?");
        $up_stmt->bind_param('si', $target_level, $alert_id);
        
        if ($up_stmt->execute()) {
            $up_stmt->close();
            
            // Log to dedicated audit table
            log_audit_action('System (Escalator)', 'Alert Escalation Transition', 'Alert ID ' . $alert_id, $before_state, $after_state);
            
            // Log in system logs
            $log_msg = "Alert ID $alert_id transitioned to escalation level '$target_level' (Elapsed: $elapsed_mins minutes)";
            $log_stmt = $conn->prepare("INSERT INTO system_logs (service_name, log_level, message) VALUES ('escalator', 'WARNING', ?)");
            $log_stmt->bind_param('s', $log_msg);
            $log_stmt->execute();
            $log_stmt->close();
            
            // Trigger Pusher notification
            triggerPusherEvent('private-eco-channel', 'alert-updated', [
                'id' => $alert_id,
                'status' => 'Active',
                'escalation_level' => $target_level
            ]);
            
            $escalations_processed++;
        }
    }
}

echo "Alert escalation check completed. Processed $escalations_processed transitions.\n";
?>
