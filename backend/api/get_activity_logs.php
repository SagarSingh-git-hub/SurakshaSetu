<?php
require_once __DIR__ . '/../config.php';

$sql = "SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT 50";
$result = $conn->query($sql);

$logs = [];
if ($result && $result->num_rows > 0) {
    while($row = $result->fetch_assoc()) {
        $logs[] = [
            'id' => $row['id'],
            'event_type' => $row['event_type'],
            'reference_id' => $row['reference_id'],
            'description' => htmlspecialchars($row['description']),
            'category' => htmlspecialchars($row['category'] ?? ''),
            'location' => htmlspecialchars($row['location'] ?? ''),
            'created_at' => $row['created_at']
        ];
    }
}

echo json_encode($logs);
$conn->close();
?>
