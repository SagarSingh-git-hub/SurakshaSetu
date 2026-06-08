<?php
require_once __DIR__ . '/../config.php';

function logActivity($conn, $event_type, $reference_id, $description, $category = null, $location = null) {
    $stmt = $conn->prepare("INSERT INTO activity_logs (event_type, reference_id, description, category, location) VALUES (?, ?, ?, ?, ?)");
    $stmt->bind_param("sssss", $event_type, $reference_id, $description, $category, $location);
    if($stmt->execute()) {
        $log_data = [
            'id' => $conn->insert_id,
            'event_type' => $event_type,
            'reference_id' => $reference_id,
            'description' => $description,
            'category' => $category,
            'location' => $location,
            'created_at' => date('c')
        ];
        // Trigger pusher event
        triggerPusherEvent('eco-channel', 'new-activity', $log_data);
        return true;
    }
    return false;
}
?>
