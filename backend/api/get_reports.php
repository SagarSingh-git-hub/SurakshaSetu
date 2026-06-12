<?php
require_once __DIR__ . '/../config.php';

$sql = "SELECT r.*, 
       GROUP_CONCAT(DISTINCT p.photo_path) as photo_paths,
       GROUP_CONCAT(DISTINCT p.object_key) as object_keys,
       GROUP_CONCAT(DISTINCT t.tag_name) as tag_names
        FROM reports r 
        LEFT JOIN report_photos p ON r.report_id = p.report_id 
        LEFT JOIN report_tags t ON r.report_id = t.report_id
        GROUP BY r.report_id 
        ORDER BY r.created_at DESC";
$result = $conn->query($sql);

$reports = [];

if ($result && $result->num_rows > 0) {
    while($row = $result->fetch_assoc()) {
        $photos = [];
        $photo_urls = [];
        if (!empty($row['photo_paths'])) {
            $photos = explode(',', $row['photo_paths']);
            $keys = !empty($row['object_keys']) ? explode(',', $row['object_keys']) : [];
            
            foreach ($photos as $i => $path) {
                if (isset($keys[$i]) && !empty($keys[$i])) {
                    $photo_urls[] = rtrim(getenv('R2_PUBLIC_URL'), '/') . '/' . ltrim($keys[$i], '/');
                } else {
                    $photo_urls[] = $path; // Fallback to photo_path
                }
            }
        }

        $tags = ['real-time']; // default tag
        if (!empty($row['tag_names'])) {
            $tags = explode(',', $row['tag_names']);
        }
        
        // Structure to match frontend expectations
        $reports[] = [
            'id' => htmlspecialchars($row['report_id']),
            'cat' => htmlspecialchars($row['category']),
            'loc' => htmlspecialchars($row['location_str']),
            'lat' => (float)$row['lat'],
            'lng' => (float)$row['lng'],
            'desc' => htmlspecialchars($row['description']),
            'status' => htmlspecialchars($row['status']),
            'priority' => htmlspecialchars($row['priority']),
            'date' => date('Y-m-d', strtotime($row['created_at'])),
            'created_at' => $row['created_at'],
            'resolved_at' => $row['resolved_at'],
            'photos' => count($photos),
            'photo_urls' => $photo_urls,
            'tags' => array_map('htmlspecialchars', $tags),
            'reporter' => htmlspecialchars($row['reporter'] ?? 'Anonymous'),
            'device_id' => htmlspecialchars($row['device_id'] ?? '')
        ];
    }
}

echo json_encode($reports);
$conn->close();
?>
